// Idempotent provisioning script — safe to re-run. Creates the app's
// exactly-two auth users (OWNER + PARTNER) via the service-role admin API
// (there is no public sign-up route in this app) and their `profiles` rows.
// Deliberately does NOT create any sample accounts/jobs/loans — add real
// ones from the app itself once logged in.
//
// Usage: fill in .env.local, then `npm run seed`.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/types/database.types";

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

  console.log("Provisioning VibeSync accounts...\n");

  for (const seedUser of SEED_USERS) {
    const userId = await findOrCreateAuthUser(
      supabase,
      seedUser.email!,
      seedUser.password!
    );

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

  console.log("\nDone. Sign in with:");
  for (const u of SEED_USERS) {
    console.log(`  ${u.role}: ${u.email}`);
  }
  console.log("\nChange these passwords after first login, then add your");
  console.log("real accounts, jobs, and loans from inside the app.");
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

main().catch((err) => {
  console.error("\nSeed failed:", err.message ?? err);
  process.exit(1);
});
