# VibeSync

A mobile-first PWA for two — hotel & secondary-job shift tracking, a gym
progressive-overload log, and a multi-account expense wallet, with strict
database-level privacy between an **ADMIN** account and a **PARTNER** account.
Built to run for free on Vercel's Hobby tier + Supabase's free tier.

## Who sees what

Two fixed accounts, no public sign-up:

| | ADMIN | PARTNER |
|---|---|---|
| Gym | Full access | **Blocked entirely** — not just "no data," the RLS policy denies the query |
| Own wallet & shifts | Full access | Full access |
| Partner's / Admin's wallet & shifts | Full access (read + write) | No access |
| Parents' accounts | Full access | No access |

This is enforced by Postgres Row Level Security, not application code — see
[`supabase/migrations/0008_rls_policies.sql`](./supabase/migrations/0008_rls_policies.sql).
Every policy reduces to one shape: `is_admin() OR user_id = auth.uid()`, with
the gym tables dropping the ownership half entirely so the partner can't
query gym data even in principle.

## Stack

- **Next.js 16** (App Router, Turbopack, Server Actions, React 19.2)
- **Supabase** — Postgres + Auth + Row Level Security
- **Tailwind CSS v4**, hand-authored shadcn/ui-style primitives (see [_why not the shadcn CLI_](#why-hand-authored-ui-components)), Lucide icons, Framer Motion
- **Recharts**, themed through a shadcn-style `ChartContainer`
- **TanStack Query v5** for client-side mutations/caching
- **A hand-rolled service worker** for PWA support (see [_why not Serwist_](#why-a-hand-rolled-service-worker))

## Getting started

### 1. Install

```bash
npm install
```

### 2. Create a Supabase project

Free tier, at [supabase.com](https://supabase.com/dashboard). Once created,
grab three values from **Project Settings → API**:

- Project URL
- `anon` public key
- `service_role` secret key (server-only — never expose this to the browser)

### 3. Run the migrations

In the Supabase dashboard's **SQL Editor**, run each file in
`supabase/migrations/` **in order** (`0001_...` through `0008_...`), or use
the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in the Supabase values from step 2, plus the two seed accounts'
emails/passwords/display names — those are read by `scripts/seed.ts`.

### 5. Seed the two accounts

```bash
npm run seed
```

Idempotent — safe to re-run. Creates the ADMIN and PARTNER auth users
(there's no public sign-up route; this script is the only way in), their
`profiles` rows, a few starter accounts (Khalti, eSewa, Nabil Bank, a
flagged parents' account, and a Sydney bank account for the partner), and
the shared gym exercise catalog.

**Change both passwords after first login.**

### 6. Run it

```bash
npm run dev
```

### 7. Deploy

Push to a GitHub repo and import it on [Vercel](https://vercel.com/new) —
Hobby tier is enough. Add the same three `NEXT_PUBLIC_SUPABASE_*` /
`SUPABASE_SERVICE_ROLE_KEY` environment variables in the Vercel project
settings (the service role key is only needed there if you plan to run
`npm run seed` against production from CI; otherwise seed once against the
same Supabase project from your machine and skip adding it to Vercel).

## How the money actually adds up

`transactions.amount` is **signed** (positive = inflow, negative = outflow)
rather than always-positive with the sign implied by `type`. A transfer is
just two ordinary rows — a negative leg on the source account, a positive
leg on the destination — so the balance trigger
(`supabase/migrations/0004_transactions.sql`) never needs to special-case
transaction types: `accounts.current_balance` is always recomputed as
`starting_balance + SUM(amount)` after every write.

Hotel-shift and secondary-shift pay are computed by **database triggers**,
not the client (`0006_hotel_shifts.sql`, `0007_secondary_shifts.sql`) — a
buggy or tampered client can submit a date and a room list, but it cannot
submit a wrong `calculated_pay`. `src/lib/calculations/shift-pay.ts` mirrors
the same formulas in TypeScript purely so the UI can show an instant
estimate while typing; the database is always the source of truth on
refetch.

A transaction is attributed to whichever user **owns the account**, not
whoever clicked submit — see `getAccountOwner` in
`src/app/(app)/wallet/actions.ts`. This is what lets the ADMIN manage the
PARTNER's accounts (the spec grants her full CRUD there) without her edits
becoming invisible on the partner's own RLS-filtered view.

## Design notes for the curious

### Why hand-authored UI components

This environment's Node runtime can't complete a TLS handshake with
`ui.shadcn.com` specifically (an intermediate-certificate issue unrelated to
this project), so the `shadcn` CLI's registry-fetch `init`/`add` flow isn't
usable here. The components in `src/components/ui/` are hand-authored in the
same idiom (Radix primitives + `class-variance-authority` + Tailwind) rather
than pulled from the registry — functionally equivalent, just written by
hand. If you have working network access to the registry, `npx shadcn@latest
add <component>` will work normally in this repo going forward.

### Why a hand-rolled service worker

Next.js 16 builds with Turbopack **by default**, and a Turbopack build fails
outright if it finds a custom `webpack` config — which every current
webpack-based PWA plugin (`@ducanh2912/next-pwa`, `@serwist/next`'s webpack
integration) injects. Rather than fight the bundler, `public/sw.js` is a
small, dependency-free service worker: cache-first for hashed static
assets, network-first with an explicit offline page for navigations, and a
hard pass-through for `/api/` and `/auth/` so financial and session data is
never served stale. It's auditable in one file and adds zero bytes to the
JS bundle.

### Why `proxy.ts` instead of `middleware.ts`

Next.js 16 renamed the `middleware` file convention to `proxy` (same
mechanism, clarified name — see the framework's own migration notes). Since
this is a new project, it uses the new convention directly:
`src/proxy.ts` → `src/lib/supabase/proxy.ts` for the actual session-refresh
and route-guard logic.

### Nav differs by role, on purpose

The bottom nav shows **Home · Work · Gym · Wallet** for the ADMIN, but
**Home · Work · Wallet** for the PARTNER — there's no point linking her to a
Gym tab that RLS will only ever show empty. The FAB's quick-log menu is
role-aware the same way.

## Project layout

```
src/
  app/
    login/                 email+password sign-in (only entry point)
    (app)/                 authenticated shell — bottom nav, FAB, header
      page.tsx             role-aware home dashboard
      work/                hotel shifts, secondary shifts, payout batches
      gym/                 ADMIN-only machine/set tracker + overload chart
      wallet/              multi-account ledger, transactions, transfers
  components/
    ui/                     hand-authored shadcn-style primitives
    nav/ dashboard/ work/ gym/ wallet/   feature components
  lib/
    supabase/               browser/server/proxy Supabase clients
    calculations/           pay-formula mirrors of the DB triggers
    types/database.types.ts hand-written Supabase types (regeneratable via the Supabase CLI once linked)
scripts/
  seed.ts                   creates the two accounts + starter data
  generate-icons.ts          rasterizes public/icons/icon-mark.svg into the PWA icon set
supabase/migrations/         numbered SQL migrations, including all RLS policies
```

## What to verify once you have a live Supabase project

This was built without a live Supabase project connected (network access to
provision one wasn't available in this environment), so `npm run build` /
`tsc` / `eslint` are clean but the following need a real end-to-end check
once you've completed steps 2–5 above:

- Logging in as each seeded account and confirming the nav/gym gating
- That a PARTNER truly cannot read gym data (try it from the Supabase SQL
  editor as that role, or just confirm the Gym tab is absent and `/gym`
  redirects her home)
- That balances update immediately after logging a transaction, shift, or
  transfer
- PWA install prompt and offline behavior on an actual phone
# vibeSync
