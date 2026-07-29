# VibeSync

A mobile-first PWA for two — multiple jobs (hourly/monthly/biweekly pay),
a multi-account expense wallet with amount-first quick-add, lend/borrow
tracking, recurring bills & salary, and a breakdown dashboard — with strict
database-level privacy between an **OWNER** account and a **PARTNER** account.
Built to run for free on Vercel's Hobby tier + Supabase's free tier.

## Who sees what

Two fixed accounts, no public sign-up:

| | OWNER | PARTNER |
|---|---|---|
| Own wallet, jobs, loans | Full access | Full access |
| Partner's / Owner's wallet, jobs, loans | Full access (read + write) | No access |
| Parents' accounts | Full access | No access |

This is enforced by Postgres Row Level Security, not application code — see
[`supabase/migrations/0008_rls_policies.sql`](./supabase/migrations/0008_rls_policies.sql)
plus the self-contained RLS blocks in `0010_recurring_transactions.sql` and
`0011_loans.sql`. Every policy reduces to one shape:
`is_owner() OR user_id = auth.uid()`.

## Stack

- **Next.js 16** (App Router, Turbopack, Server Actions, React 19.2, **Cache
  Components** — Partial Prerendering + `<Activity>`-based nav state, React
  Compiler, native `<ViewTransition>`)
- **Supabase** — Postgres + Auth + Row Level Security
- **Tailwind CSS v4**, hand-authored shadcn/ui-style primitives (see [_why not the shadcn CLI_](#why-hand-authored-ui-components)), Lucide icons
- **Recharts**, themed through a shadcn-style `ChartContainer`
- **A hand-rolled service worker** for PWA support (see [_why not Serwist_](#why-a-hand-rolled-service-worker)), plus a `localStorage`-backed offline queue for quick-add (see [_offline quick-add_](#offline-quick-add))

All data fetching is Server Components + Server Actions + `revalidatePath` —
there's no client-side data-fetching library.

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
`supabase/migrations/` **in order** (`0001_...` through `0011_...`), or use
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

Idempotent — safe to re-run. Creates the OWNER and PARTNER auth users
(there's no public sign-up route; this script is the only way in), their
`profiles` rows, a few starter accounts (Khalti, eSewa, Nabil Bank, a cash
wallet, a flagged parents' account, and a Sydney bank account for the
partner), two sample jobs (one hourly, one monthly-salary), a couple of
recurring bills/salary schedules, and one sample loan.

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

Jobs are generic (`0006_jobs.sql`): any number per user, each either
`FULL_TIME`/`PART_TIME` and paid `HOURLY`/`MONTHLY`/`BIWEEKLY`. Hourly jobs
log `job_shifts` (pay is trigger-derived from the job's `hourly_rate`, never
trusted from the client) and settle via `settle_job_shifts()`, which bundles
every pending shift into a `payout_batches` row **and** posts a real wallet
deposit in one atomic call. Salaried jobs skip shifts entirely and instead
get a linked `recurring_transactions` row (`direction = 'INCOME'`) — a
salaried job IS its recurring paycheck. `src/lib/calculations/job-pay.ts`
mirrors the hourly formula in TypeScript purely so the UI can show an
instant estimate while typing; the database is always the source of truth.

Lending/borrowing (`0011_loans.sql`) shares one `loans` table for both
directions (`direction` flips the sign everywhere) plus `loan_repayments`
for partial paydowns. Creating or repaying a loan posts an ordinary signed
`transactions` row (typed `LOAN`/`REPAYMENT`, tagged with `loan_id`) so it
shows in the normal ledger but is easy to exclude from expense-category
spending analysis. The `loan_balances` view nets everything per counterparty
for the "who owes who" rollup.

A transaction is attributed to whichever user **owns the account**, not
whoever clicked submit — see `getAccountOwner`/`insertSignedTransaction` in
`src/lib/wallet/create-transaction.ts`. This is what lets the OWNER manage
the PARTNER's accounts (the spec grants her full CRUD there) without her
edits becoming invisible on the partner's own RLS-filtered view.

## Offline quick-add

The FAB opens a full-screen, amount-first keypad (`components/wallet/
quick-add-sheet.tsx`) that POSTs to `/api/wallet/quick-add` — a plain fetch
endpoint, not a Server Action, specifically so it can be replayed later.
If the device is offline (or the request fails), the entry is queued in
`localStorage` (`src/lib/offline-queue.ts`) instead, shown optimistically
right away, and flushed automatically on the next `online` event or app
load (`components/pwa/offline-sync.tsx`). This deliberately skips the
Background Sync API — it has no support on iOS Safari, which is most of
this app's real usage, so a sync registration would silently never fire
there; flush-on-reconnect covers the actual case (phone regains signal
while the app is open) without that platform gap.

## Design notes for the curious

### Why `'use cache: private'` instead of plain `'use cache'`

Every `data.ts` fetcher (`wallet/data.ts`, `work/data.ts`, `loans/data.ts`,
the dashboard's `data.ts`) is `'use cache: private'` with `cacheLife('seconds')`
(30s client stale / 1s revalidate). Plain `'use cache'` can't call
`cookies()`/`headers()`, which the Supabase server client needs for the
session — and even if it could, its result is a **shared** server-side
cache, wrong for RLS-scoped per-user data. `'use cache: private'` is cached
only in that browser's own memory, never written to a shared store, so
there's no cross-user leak surface at all — OWNER and PARTNER each just have
their own independent in-memory cache. Practical effect: switching between
Home/Work/Wallet/Loans and coming back within ~30s is instant (no network
round trip), while every mutating Server Action's existing `revalidatePath`
call clears the *entire* client cache immediately per Next's documented
behavior — so a save on this device is never masked by the window. A hard
reload always re-executes against Supabase fresh, since private-cache
functions are excluded from static-shell prerendering. The only residual
staleness is cross-device (a change on one phone can take up to 30s to show
on the other's already-open tab) — inherent to any client cache without a
push channel, and tight enough not to matter for two people's finances.

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

## Project layout

```
src/
  app/
    login/                  email+password sign-in (only entry point)
    (app)/                  authenticated shell — bottom nav, FAB, header
      page.tsx              dashboard — net worth, week/month breakdown, upcoming
      work/                 jobs (hourly/monthly/biweekly), shifts, payout batches
      wallet/               multi-account ledger, quick-add, transfers, recurring
      loans/                lend/borrow tracking, per-counterparty rollup
    api/wallet/
      quick-add/            plain fetch endpoint behind the offline queue
      export/                CSV export
  components/
    ui/                      hand-authored shadcn-style primitives
    nav/ dashboard/ work/ wallet/ loans/ pwa/   feature components
  lib/
    supabase/                browser/server/proxy Supabase clients
    calculations/            pay-formula mirrors of the DB triggers
    offline-queue.ts         localStorage-backed quick-add retry queue
    dashboard.ts             week/month period helpers
    types/database.types.ts  hand-written Supabase types (regeneratable via the Supabase CLI once linked)
scripts/
  seed.ts                    creates the two accounts + starter data
  generate-icons.ts          rasterizes public/icons/icon-mark.svg into the PWA icon set
supabase/migrations/          numbered SQL migrations, including all RLS policies
```

## What to verify once you have a live Supabase project

This was built without a live Supabase project connected (network access to
provision one wasn't available in this environment), so `npm run build` /
`tsc` / `eslint` are clean but the following need a real end-to-end check
once you've completed steps 2–5 above:

- Logging in as each seeded account and confirming the OWNER/PARTNER RLS
  scoping across accounts, jobs, and loans
- That balances update immediately after a transaction, shift settlement,
  recurring "mark paid", loan, or transfer
- PWA install prompt and offline behavior on an actual phone — specifically
  the quick-add offline queue: add an expense in airplane mode, confirm it
  shows optimistically, then confirm it actually posts once back online
- That `migrations/0006_jobs.sql` through `0011_loans.sql` apply cleanly
  against a real project (only ever run against an empty `transactions`
  table in this build)
- `add_calendar_month()`'s month-overflow clamping — e.g.
  `select public.add_calendar_month(date '2026-01-31');` should return
  `2026-02-28`, not roll into March
- "Mark paid" on a recurring bill/salary: confirm it inserts one real
  transaction, advances `next_due_date` by the right interval, and that a
  PARTNER can only settle her own rows (RPC is `security invoker`)
- `settle_job_shifts()`: confirm it posts one deposit transaction tagged
  with `job_id` and flips every pending shift to `PAID` in the same call
- `create_loan()`/`repay_loan()`: confirm the signed ledger row matches the
  loan's direction, and that `loan_balances` nets correctly across multiple
  loans with the same counterparty
- CSV export (`/api/wallet/export`) ownership scoping — a PARTNER's export
  should never include the OWNER's rows, and `?scope=all` should only work
  for the OWNER
- Browser due-date notifications: the permission prompt, and that a bill/
  salary row only notifies once per local day (not on every page load)
- Real Lighthouse scores and Cache Components' static-shell behavior against
  the actual Vercel deployment — the streaming/PPR structure builds cleanly
  here, but perceived speed depends on real network/Supabase latency this
  sandbox can't reproduce
