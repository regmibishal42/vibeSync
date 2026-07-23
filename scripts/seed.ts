// Idempotent seed script — safe to re-run. Creates the app's exactly-two
// auth users (ADMIN + PARTNER) via the service-role admin API (there is no
// public sign-up route in this app), their profiles, a few starter
// accounts, and the shared gym exercise catalog.
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
    role: "ADMIN" as const,
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
    fullName: process.env.SEED_ADMIN_NAME || "Me",
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

const GYM_EXERCISES = [
  { name: "Bench Press", target_muscle: "Chest", machine_name: "Smith Machine" },
  { name: "Squat", target_muscle: "Legs", machine_name: "Squat Rack" },
  { name: "Deadlift", target_muscle: "Back", machine_name: "Barbell" },
  { name: "Lat Pulldown", target_muscle: "Back", machine_name: "Cable Machine" },
  { name: "Shoulder Press", target_muscle: "Shoulders", machine_name: "Dumbbell" },
  { name: "Leg Press", target_muscle: "Legs", machine_name: "Leg Press Machine" },
  { name: "Bicep Curl", target_muscle: "Arms", machine_name: "Dumbbell" },
  { name: "Tricep Pushdown", target_muscle: "Arms", machine_name: "Cable Machine" },
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

  const userIds: Record<"ADMIN" | "PARTNER", string> = {
    ADMIN: "",
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

  await ensureAccount(supabase, userIds.ADMIN, {
    account_name: "Khalti",
    account_type: "DIGITAL_WALLET",
    starting_balance: 5000,
  });
  await ensureAccount(supabase, userIds.ADMIN, {
    account_name: "eSewa",
    account_type: "DIGITAL_WALLET",
    starting_balance: 3000,
  });
  await ensureAccount(supabase, userIds.ADMIN, {
    account_name: "Nabil Bank",
    account_type: "BANK",
    starting_balance: 45000,
  });
  await ensureAccount(supabase, userIds.ADMIN, {
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

  // next_due_date computed relative to "today" (not a fixed past date) so a
  // re-run always demonstrates a soon-due bill regardless of when seed runs.
  const soon = new Date();
  soon.setDate(soon.getDate() + 3);
  const nextDueDate = toLocalDateKey(soon);

  await ensureRecurringBill(supabase, userIds.PARTNER, {
    account_name: "Sydney Commonwealth",
    label: "Rent",
    category: "RENT",
    amount: 650,
    frequency: "BIWEEKLY",
    next_due_date: nextDueDate,
  });
  await ensureRecurringBill(supabase, userIds.ADMIN, {
    account_name: "Nabil Bank",
    label: "Sim plan",
    category: "SIM_PLAN",
    amount: 999,
    frequency: "MONTHLY",
    next_due_date: nextDueDate,
  });

  for (const exercise of GYM_EXERCISES) {
    const { data: existing } = await supabase
      .from("gym_exercises")
      .select("id")
      .eq("name", exercise.name)
      .maybeSingle();

    if (existing) continue;

    const { error } = await supabase.from("gym_exercises").insert(exercise);
    if (error) throw error;
    console.log(`✓ exercise seeded: ${exercise.name}`);
  }

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

async function ensureRecurringBill(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
  bill: {
    account_name: string;
    label: string;
    category: Database["public"]["Enums"]["expense_category"];
    amount: number;
    frequency: Database["public"]["Enums"]["recurring_frequency"];
    next_due_date: string;
  }
) {
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("account_name", bill.account_name)
    .maybeSingle();
  if (!account) throw new Error(`Seed account not found: ${bill.account_name}`);

  const { data: existing } = await supabase
    .from("recurring_bills")
    .select("id")
    .eq("user_id", userId)
    .eq("label", bill.label)
    .maybeSingle();
  if (existing) return;

  const { error } = await supabase.from("recurring_bills").insert({
    user_id: userId,
    account_id: account.id,
    label: bill.label,
    category: bill.category,
    amount: bill.amount,
    frequency: bill.frequency,
    next_due_date: bill.next_due_date,
  });
  if (error) throw error;
  console.log(`✓ recurring bill seeded: ${bill.label}`);
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message ?? err);
  process.exit(1);
});
