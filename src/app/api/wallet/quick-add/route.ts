import { revalidateTag } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { insertSignedTransaction } from "@/lib/wallet/create-transaction";
import { CATEGORY_ORDER } from "@/lib/wallet/categories";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { ExpenseCategory } from "@/lib/types/database.types";

// Plain fetchable endpoint (not a Server Action) so the offline queue in
// lib/offline-queue.ts can replay a queued quick-add with an ordinary
// fetch() once the device is back online — a Server Action's encoded call
// isn't something you can safely reconstruct and resend outside the
// original page/transition.
const categoryEnum = CATEGORY_ORDER as [ExpenseCategory, ...ExpenseCategory[]];

const quickAddSchema = z.object({
  accountId: z.string().uuid(),
  type: z.enum(["EXPENSE", "DEPOSIT"]),
  amount: z.number().positive(),
  category: z.enum(categoryEnum).optional(),
  merchantOrItem: z.string().optional(),
  transactionDate: z.string().min(1),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Malformed request body" }, { status: 400 });
  }

  const parsed = quickAddSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { error } = await insertSignedTransaction(supabase, parsed.data);
  if (error) {
    return Response.json({ error }, { status: 400 });
  }

  // updateTag() is action-only — this is a Route Handler, so its precise
  // tag-scoped equivalent is revalidateTag(tag, { expire: 0 }) (immediate
  // expiration, matching updateTag's read-your-own-writes semantics rather
  // than the 'max' profile's background stale-while-revalidate).
  revalidateTag(CACHE_TAGS.walletAccounts, { expire: 0 });
  revalidateTag(CACHE_TAGS.walletTransactions, { expire: 0 });
  revalidateTag(CACHE_TAGS.dashboardAccounts, { expire: 0 });
  revalidateTag(CACHE_TAGS.dashboardTransactions, { expire: 0 });
  return Response.json({ success: true });
}
