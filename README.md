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

All data fetching is Server Components + Server Actions + tag-scoped
`updateTag`/`revalidateTag` invalidation (see [_why `updateTag`, not
`revalidatePath`_](#why-updatetag-not-revalidatepath-in-every-server-action)) —
there's no client-side data-fetching library. See
[`DOCUMENTATION.md`](./DOCUMENTATION.md) for the full data model, RPC
reference, and architecture deep-dive; this README stays a quick-start.

## Getting started

### 1. Install

```bash
npm install
```

Useful scripts: `npm run dev`, `npm run build`, `npm run lint`, and
`npm run check` (assertion self-check over the pure money/date logic —
period bucketing, LIKE escaping, currency grouping, pay rounding).

### 2. Create a Supabase project

Free tier, at [supabase.com](https://supabase.com/dashboard). Once created,
grab three values from **Project Settings → API**:

- Project URL
- `anon` public key
- `service_role` secret key (server-only — never expose this to the browser)

### 3. Run the migrations

In the Supabase dashboard's **SQL Editor**, run each file in
`supabase/migrations/` **in order** (`0001_...` through `0012_...`), or use
the Supabase CLI:

> **If you're retrying after a partial failure**: an interrupted earlier run
> can leave enum types (e.g. `profile_role`) created with stale values —
> every `CREATE TYPE` here is guarded with `EXCEPTION WHEN duplicate_object
> THEN NULL`, which silently *skips* recreating a type that already exists,
> even with the wrong values. Since a fresh project has no real data, the
> simplest fix is dropping this app's own objects first (see
> [`DOCUMENTATION.md`](./DOCUMENTATION.md#resetting-a-partially-applied-schema)
> for the drop list) and re-running the migrations clean.

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

Idempotent — safe to re-run. Creates only the OWNER and PARTNER auth users
(there's no public sign-up route; this script is the only way in) and their
`profiles` rows — deliberately no sample accounts/jobs/loans, so the app
starts genuinely empty. Add real accounts, jobs, and loans from inside the
app itself after logging in.

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

Mistakes are fixable: a transaction can be deleted from the wallet list.
That runs through `delete_transaction()` rather than a plain DELETE, because
a transfer has to lose **both** legs at once (they share a
`transfer_group_id`) or two accounts end up permanently out of balance, and
loan-owned rows have to be refused so `loans.is_settled` never starts lying.
See [_Ledger integrity guarantees_](./DOCUMENTATION.md#ledger-integrity-guarantees)
for the full list of what's enforced at the database layer.

`formatCurrency()` (`src/lib/format.ts`) picks its `Intl.NumberFormat`
locale from the currency, not a fixed one: NPR renders lakh/crore-grouped
(`Rs 12,34,567.50` — thousands, then every 2 digits) via the `en-IN`
locale, while every other currency (AUD, USD, ...) stays Western-grouped
(`$1,234,567.50`) via `en-US`. Same plain 0-9 digits either way — only the
grouping rule changes, which is why it's `en-IN` and not `ne-NP` (that
locale would also switch to Devanagari numerals).

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
round trip). The only residual staleness is cross-device (a change on one
phone can take up to 30s to show on the other's already-open tab) —
inherent to any client cache without a push channel, and tight enough not
to matter for two people's finances.

### Why `updateTag`, not `revalidatePath`, in every Server Action

`revalidatePath` called from a Server Action currently has a documented
Next.js limitation: it "causes all previously visited pages to refresh when
navigated to again" — regardless of which path you actually pass. Given
every route here is `'use cache: private'`, that meant adding an expense
would make switching to the *unrelated* Work or Loans tab also trigger a
refetch, even though nothing there changed. Every `data.ts` fetcher's
`cacheTag(...)` call uses a name from `src/lib/cache-tags.ts`, and every
Server Action calls `updateTag(...)` for exactly the tags the write actually
touched (the one Route Handler, `/api/wallet/quick-add`, uses
`revalidateTag(tag, { expire: 0 })` instead — `updateTag` only works inside
Server Actions). A few mutations intentionally over-invalidate by one tag
when they can't cheaply tell which surface applies without an extra query
(e.g. `markRecurringTransactionPaid` always busts `work-jobs`/
`dashboard-jobs` too, since the row being paid might be a job-linked
salary) — still far more precise than nuking every visited page, and the
comment at each call site says why.

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

## Verified against a live Supabase project

Everything below has been run end-to-end against a real Supabase project
(schema applied, both accounts seeded, real login sessions), not just
reasoned through statically:

- OWNER/PARTNER RLS scoping — confirmed both via direct API calls under each
  user's real session token and via actual rendered pages (a PARTNER's
  `/wallet` page never contains the OWNER's account names in the HTML)
- The balance-recalc trigger after a plain transaction insert
- `create_loan()` / `repay_loan()`, including repaying into a *different*
  account than the loan was created from (lent from bank, repaid in cash)
- `repay_loan()`'s guards: overpayment, non-positive amount, and
  already-settled all reject with a clear error
- `settle_job_shifts()`: shift → payout batch → real deposit → `PAID`, in
  one call
- `mark_recurring_transaction_paid()` — this is where a real bug was found
  (a `CASE` expression resolving to `text` instead of `transaction_type`/
  `date`, which Postgres won't auto-cast) and fixed; re-verified after
  the fix
- `loan_balances` view nets correctly across multiple loans with the same
  counterparty
- The `/api/wallet/quick-add` route through a real authenticated request
- `scripts/seed.ts` idempotency (safe to re-run)

Still worth checking on your own deployment, since this environment can't
reproduce them:

- PWA install prompt and offline behavior on an actual phone — specifically
  the quick-add offline queue: add an expense in airplane mode, confirm it
  shows optimistically, then confirm it actually posts once back online
- CSV export (`/api/wallet/export`) ownership scoping — a PARTNER's export
  should never include the OWNER's rows, and `?scope=all` should only work
  for the OWNER
- Browser due-date notifications: the permission prompt, and that a bill/
  salary row only notifies once per local day (not on every page load)
- Real Lighthouse scores and the `'use cache: private'` tab-switch speedup
  against the actual Vercel deployment — verified locally against a
  production build (`next build && next start`), but perceived speed on a
  real device depends on real network latency this environment can't fully
  reproduce
- `add_calendar_month()`'s month-overflow clamping on a date actually
  crossing a shorter month, e.g. `select public.add_calendar_month(date
  '2026-01-31');` should return `2026-02-28`
