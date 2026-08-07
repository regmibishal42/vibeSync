import type { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { ACCOUNT_TYPE_LABEL } from "@/lib/wallet/account-type";
import { CATEGORY_META } from "@/lib/wallet/categories";
import { todayLocalISO } from "@/lib/format";
import type { ExpenseCategory } from "@/lib/types/database.types";

// Not covered by public/sw.js's caching logic — that SW already passes
// `/api/` straight through uncached, so no service-worker change is needed
// here.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const q = searchParams.get("q");
  // There is deliberately no cross-account export any more. Strict isolation
  // (0013) means RLS returns only the caller's own rows regardless, so the
  // old `?scope=all` branch could no longer do what its name claimed —
  // keeping it would have advertised a capability that silently does nothing.

  let query = supabase
    .from("transactions")
    .select("*")
    .order("transaction_date", { ascending: false });

  if (category) query = query.eq("category", category as ExpenseCategory);
  if (from) query = query.gte("transaction_date", from);
  if (to) query = query.lte("transaction_date", to);
  if (q) query = query.ilike("merchant_or_item", `%${q}%`);

  const [{ data: transactions }, { data: accounts }, { data: profiles }] = await Promise.all([
    query,
    supabase.from("accounts").select("*"),
    supabase.from("profiles").select("id, full_name, currency_preference"),
  ]);

  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  // Belt-and-braces: RLS already restricts this to the caller.
  const scoped = (transactions ?? []).filter((t) => t.user_id === user.id);

  const rows = scoped.map((t) => {
    const account = accountById.get(t.account_id);
    const owner = profileById.get(t.user_id);

    return {
      date: t.transaction_date.slice(0, 10),
      type: t.type,
      category: t.category ? CATEGORY_META[t.category].label : "",
      merchant_or_item: t.merchant_or_item ?? "",
      account_name: account?.account_name ?? "",
      account_type: account ? ACCOUNT_TYPE_LABEL[account.account_type] : "",
      amount: t.amount,
      currency: owner?.currency_preference ?? "",
      owner: owner?.full_name ?? "",
    };
  });

  const csv = toCsv(rows, [
    "date",
    "type",
    "category",
    "merchant_or_item",
    "account_name",
    "account_type",
    "amount",
    "currency",
    "owner",
  ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vibesync-transactions-${todayLocalISO()}.csv"`,
    },
  });
}
