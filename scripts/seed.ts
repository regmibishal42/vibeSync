// Idempotent seed script — safe to re-run. Creates the app's exactly-two
// auth users (OWNER + PARTNER) via the service-role admin API (there is no
// public sign-up route in this app), their profiles, a few starter
// accounts, jobs, recurring transactions, and a sample loan.
//
// Usage: fill in .env.local, then `npm run seed`.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/types/database.types";
import { toLocalDateKey } from "../src/lib/format";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SEED_USERS = [
  {
    role: "OWNER" as const,
    email: process.env.SEED_OWNER_EMAIL,
    password: process.env.SEED_OWNER_PASSWORD,
    fullName: process.env.SEED_OWNER_NAME || "Me",
    currency: "NPR",
  },
  {
    role: "PARTNER" as const,
    email: process.env.SEED_PARTNER_EMAIL,
    password: process.env.SEED_PARTNER_PASSWORD,
    fullName: process.env.SEED_PARTNER_NAME || "Partner",
    currency: "AUD",
  },
];

async function main() {
  if (!SUPABASE_URL || SUPABASE_URL.includes("placeholder")) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is missing or still a placeholder — set it in .env.local first."
    );
  }
  if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.includes("placeholder")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing or still a placeholder — set it in .env.local first."
    );
  }
  for (const u of SEED_USERS) {
    if (!u.email || !u.password) {
      throw new Error(
        `Missing SEED_${u.role}_EMAIL / SEED_${u.role}_PASSWORD in .env.local`
      );
    }
  }

  const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Seeding VibeSync...\n");

  const userIds: Record<"OWNER" | "PARTNER", string> = {
    OWNER: "",
    PARTNER: "",
  };

  for (const seedUser of SEED_USERS) {
    const userId = await findOrCreateAuthUser(
      supabase,
      seedUser.email!,
      seedUser.password!
    );
    userIds[seedUser.role] = userId;

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        role: seedUser.role,
        full_name: seedUser.fullName,
        currency_preference: seedUser.currency,
      },
      { onConflict: "id" }
    );

    if (profileError) throw profileError;
    console.log(`✓ profile ready: ${seedUser.fullName} (${seedUser.role})`);
  }

  await ensureAccount(supabase, userIds.OWNER, {
    account_name: "Khalti",
    account_type: "DIGITAL_WALLET",
    starting_balance: 5000,
  });
  await ensureAccount(supabase, userIds.OWNER, {
    account_name: "eSewa",
    account_type: "DIGITAL_WALLET",
    starting_balance: 3000,
  });
  await ensureAccount(supabase, userIds.OWNER, {
    account_name: "Nabil Bank",
    account_type: "BANK",
    starting_balance: 45000,
  });
  await ensureAccount(supabase, userIds.OWNER, {
    account_name: "Cash Wallet",
    account_type: "CASH",
    starting_balance: 2000,
  });
  await ensureAccount(supabase, userIds.OWNER, {
    account_name: "Parents' Everest Bank",
    account_type: "BANK",
    starting_balance: 20000,
    is_parent_account: true,
  });
  await ensureAccount(supabase, userIds.PARTNER, {
    account_name: "Sydney Commonwealth",
    account_type: "BANK",
    starting_balance: 800,
  });

  const ownerBank = await getAccountId(supabase, userIds.OWNER, "Nabil Bank");
  await ensureJob(supabase, userIds.OWNER, {
    name: "Housekeeping (Hotel)",
    employment_type: "PART_TIME",
    pay_type: "HOURLY",
    hourly_rate: 25,
    deposit_account_id: ownerBank,
  });
  await ensureJob(supabase, userIds.OWNER, {
    name: "Software Dev (Full-time)",
    employment_type: "FULL_TIME",
    pay_type: "MONTHLY",
    deposit_account_id: ownerBank,
  });

  // next_due_date computed relative to "today" (not a fixed past date) so a
  // re-run always demonstrates a soon-due bill regardless of when seed runs.
  const soon = new Date();
  soon.setDate(soon.getDate() + 3);
  const nextDueDate = toLocalDateKey(soon);

  await ensureRecurringTransaction(supabase, userIds.PARTNER, {
    account_name: "Sydney Commonwealth",
    label: "Rent",
    direction: "EXPENSE",
    category: "RENT",
    amount: 650,
    frequency: "BIWEEKLY",
    next_due_date: nextDueDate,
  });
  await ensureRecurringTransaction(supabase, userIds.OWNER, {
    account_name: "Nabil Bank",
    label: "Phone plan",
    direction: "EXPENSE",
    category: "PHONE_BILL",
    amount: 999,
    frequency: "MONTHLY",
    next_due_date: nextDueDate,
  });
  await ensureRecurringTransaction(supabase, userIds.OWNER, {
    account_name: "Nabil Bank",
    label: "Software Dev salary",
    direction: "INCOME",
    amount: 85000,
    frequency: "MONTHLY",
    next_due_date: nextDueDate,
  });

  await ensureLoan(supabase, userIds.OWNER, {
    account_name: "Cash Wallet",
    counterparty_name: "Ram",
    direction: "LENT",
    principal_amount: 3000,
  });

  console.log("\nDone. Sign in with:");
  for (const u of SEED_USERS) {
    console.log(`  ${u.role}: ${u.email}`);
  }
  console.log("\nChange these passwords after first login.");
}

async function findOrCreateAuthUser(
  supabase: ReturnType<typeof createClient<Database>>,
  email: string,
  password: string
): Promise<string> {
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) throw listError;

  const existing = list.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );
  if (existing) {
    console.log(`✓ auth user already exists: ${email}`);
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error(`Could not create ${email}`);

  console.log(`✓ auth user created: ${email}`);
  return data.user.id;
}

async function ensureAccount(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
  account: {
    account_name: string;
    account_type: "DIGITAL_WALLET" | "BANK" | "CASH";
    starting_balance: number;
    is_parent_account?: boolean;
  }
) {
  const { data: existing } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("account_name", account.account_name)
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase.from("accounts").insert({
    user_id: userId,
    ...account,
  });
  if (error) throw error;
  console.log(`✓ account seeded: ${account.account_name}`);
}

async function getAccountId(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
  accountName: string
): Promise<string> {
  const { data } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("account_name", accountName)
    .maybeSingle();
  if (!data) throw new Error(`Seed account not found: ${accountName}`);
  return data.id;
}

async function ensureJob(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
  job: {
    name: string;
    employment_type: "FULL_TIME" | "PART_TIME";
    pay_type: "HOURLY" | "MONTHLY" | "BIWEEKLY";
    hourly_rate?: number;
    deposit_account_id: string;
  }
) {
  const { data: existing } = await supabase
    .from("jobs")
    .select("id")
    .eq("user_id", userId)
    .eq("name", job.name)
    .maybeSingle();
  if (existing) return;

  const { error } = await supabase.from("jobs").insert({
    user_id: userId,
    ...job,
  });
  if (error) throw error;
  console.log(`✓ job seeded: ${job.name}`);
}

async function ensureRecurringTransaction(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
  item: {
    account_name: string;
    label: string;
    direction: Database["public"]["Enums"]["recurring_direction"];
    category?: Database["public"]["Enums"]["expense_category"];
    amount: number;
    frequency: Database["public"]["Enums"]["recurring_frequency"];
    next_due_date: string;
  }
) {
  const accountId = await getAccountId(supabase, userId, item.account_name);

  const { data: existing } = await supabase
    .from("recurring_transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("label", item.label)
    .maybeSingle();
  if (existing) return;

  const { error } = await supabase.from("recurring_transactions").insert({
    user_id: userId,
    account_id: accountId,
    label: item.label,
    direction: item.direction,
    category: item.category,
    amount: item.amount,
    frequency: item.frequency,
    next_due_date: item.next_due_date,
  });
  if (error) throw error;
  console.log(`✓ recurring transaction seeded: ${item.label}`);
}

async function ensureLoan(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
  loan: {
    account_name: string;
    counterparty_name: string;
    direction: Database["public"]["Enums"]["loan_direction"];
    principal_amount: number;
  }
) {
  const { data: existing } = await supabase
    .from("loans")
    .select("id")
    .eq("user_id", userId)
    .eq("counterparty_name", loan.counterparty_name)
    .maybeSingle();
  if (existing) return;

  const accountId = await getAccountId(supabase, userId, loan.account_name);

  // create_loan()/repay_loan() are SECURITY INVOKER and derive user_id from
  // auth.uid(), which is null under the service-role key this script uses —
  // insert the loan + its ledger leg directly instead (same as every other
  // ensure* helper here, and it's the service-role key so RLS doesn't apply).
  const { data: newLoan, error: loanError } = await supabase
    .from("loans")
    .insert({
      user_id: userId,
      account_id: accountId,
      counterparty_name: loan.counterparty_name,
      direction: loan.direction,
      principal_amount: loan.principal_amount,
    })
    .select("id")
    .single();
  if (loanError || !newLoan) throw loanError ?? new Error("Could not create loan");

  const signedAmount =
    loan.direction === "LENT" ? -loan.principal_amount : loan.principal_amount;

  const { error: txError } = await supabase.from("transactions").insert({
    account_id: accountId,
    user_id: userId,
    amount: signedAmount,
    type: "LOAN",
    merchant_or_item: loan.counterparty_name,
    loan_id: newLoan.id,
  });
  if (txError) throw txError;
  console.log(`✓ loan seeded: ${loan.counterparty_name}`);
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message ?? err);
  process.exit(1);
});
