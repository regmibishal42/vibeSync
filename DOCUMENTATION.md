# VibeSync — Technical Documentation

Deep-reference companion to [`README.md`](./README.md) (which stays the
quick-start + high-level design notes). This covers the data model, every
RPC function, the RLS model, and the caching/offline architecture in full.

## Contents

- [Feature tour](#feature-tour)
- [Data model](#data-model)
- [Money flow](#money-flow)
- [RPC function reference](#rpc-function-reference)
- [Row Level Security model](#row-level-security-model)
- [Caching & performance architecture](#caching--performance-architecture)
- [Offline quick-add architecture](#offline-quick-add-architecture)
- [Dev workflow](#dev-workflow)
- [Resetting a partially applied schema](#resetting-a-partially-applied-schema)

## Feature tour

Two fixed accounts — **OWNER** and **PARTNER** — no public sign-up. Four
routes:

- **Home (`/`)** — net worth + a 14-day low-balance forecast, a week/month
  toggle driving income/expense stats + top-spending-category +
  bank-wise net-flow + job-wise income breakdowns, and a unified upcoming
  list (bills, salary, loan due dates).
- **Wallet (`/wallet`)** — every account (bank/wallet/cash), the signed
  transaction ledger, an amount-first "quick add" keypad (works offline),
  transfers (auto-labeled as *Cash Withdrawal*/*Cash Deposit* when the
  legs are BANK↔CASH), and recurring bills/salary schedules.
- **Work (`/work`)** — any number of jobs, each `FULL_TIME`/`PART_TIME` and
  paid `HOURLY` (log shifts, settle into one payout + real deposit) or
  `MONTHLY`/`BIWEEKLY` (a linked recurring income schedule instead).
- **Loans (`/loans`)** — lend-to/borrow-from-a-person tracking with partial
  repayments (optionally into a *different* account than the loan was
  created from) and a per-counterparty "who owes who" rollup.

OWNER sees and can act on both people's data everywhere; PARTNER is
strictly isolated to her own rows. This is enforced by Postgres RLS, not
application code — see [Row Level Security model](#row-level-security-model).

## Data model

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | One row per `auth.users` row | `role` (`OWNER`\|`PARTNER`), `currency_preference` |
| `accounts` | Bank/digital-wallet/cash accounts | `account_type`, `starting_balance`, `current_balance` (trigger-maintained), `is_parent_account` |
| `transactions` | The signed ledger — every money movement | `amount` (signed), `type` (`EXPENSE`\|`DEPOSIT`\|`TRANSFER`\|`LOAN`\|`REPAYMENT`), `category`, `job_id`, `loan_id` |
| `jobs` | Generic income sources | `employment_type`, `pay_type`, `hourly_rate`, `deposit_account_id` |
| `job_shifts` | Hourly-job time entries | `hours_worked`, `calculated_pay` (trigger-derived), `payout_status`, `payout_batch_id` |
| `payout_batches` | Groups settled shifts into one payout | `job_id`, `total_amount` |
| `recurring_transactions` | Scheduled bills (EXPENSE) or salary (INCOME) | `direction`, `frequency`, `next_due_date`, `job_id` (nullable — set when this schedule IS a job's salary) |
| `loans` | One row per lend/borrow event | `direction` (`LENT`\|`BORROWED`), `principal_amount`, `is_settled` |
| `loan_repayments` | Partial paydowns against a loan | `amount`, `transaction_id` (links to the ledger row it posted) |
| `loan_balances` (view) | Net position per counterparty | `net_outstanding` (positive = they owe you, negative = you owe them) |

Every enum type lives in `0001_extensions_enums.sql`. Full column-level
detail is in the migration files themselves (`supabase/migrations/`) — they're
short and meant to be read.

## Money flow

`transactions.amount` is signed (positive = inflow, negative = outflow). A
transfer is just two ordinary rows — a negative leg on the source account, a
positive leg on the destination — so `recalc_account_balance()`
(`0004_transactions.sql`) never special-cases transaction types:
`accounts.current_balance` is always recomputed as
`starting_balance + SUM(amount)` after every write.

Every write is attributed to whichever user **owns the account**, never
whoever clicked submit — see `getAccountOwner`/`insertSignedTransaction` in
`src/lib/wallet/create-transaction.ts`. This is what lets the OWNER manage
the PARTNER's accounts without her edits vanishing from her own
RLS-filtered view.

`LOAN`/`REPAYMENT` are their own `transactions.type` values (not folded into
`EXPENSE`/`DEPOSIT`) specifically so lending/borrowing never pollutes
expense-category spending analysis, while still appearing in the normal
ledger, tagged with `loan_id`.

## RPC function reference

All are `SECURITY INVOKER` (RLS applies as the calling user; `is_owner()`
lets OWNER act on PARTNER's rows and vice versa) unless noted.

| Function | Args | Does |
|---|---|---|
| `is_owner()` | — | `SECURITY DEFINER`. The single boolean every RLS policy reduces to: `is_owner() OR user_id = auth.uid()`. |
| `settle_job_shifts(p_job_id, p_paid_date?, p_note?)` | job id, date, note | Bundles every `PENDING` shift for a job into one `payout_batches` row, flips them to `PAID`, and posts one real deposit `transactions` row (tagged `job_id`) — atomic, not sequential client calls. |
| `mark_recurring_transaction_paid(p_recurring_id, p_paid_date?)` | recurring row id, date | Posts one signed `transactions` row (sign/type flipped by `direction`) and advances `next_due_date` by the row's `frequency`. Works for both bills (EXPENSE) and salary (INCOME). |
| `create_loan(p_account_id, p_counterparty_name, p_direction, p_principal_amount, p_loan_date?, p_due_date?, p_notes?)` | — | Inserts the `loans` row and posts the initial signed `transactions` leg (type `LOAN`). `user_id` is derived from the account's actual owner, not `auth.uid()`. |
| `repay_loan(p_loan_id, p_amount, p_paid_date?, p_account_id?)` | — | Posts a `REPAYMENT` transaction (sign reversed from the loan's original direction) into `p_account_id` — defaults to the loan's own account, but can be any account **belonging to the loan's owner** (e.g. lent from bank, repaid in cash). Rejects non-positive amounts, amounts exceeding the remaining balance, and repayments on an already-settled loan. Auto-settles the loan once repayments cover the principal. |
| `add_calendar_month(d)` | date | Advances a date by one calendar month, clamped to the shorter month's last day (`2026-01-31` → `2026-02-28`, not a March rollover). |

## Row Level Security model

Every policy reduces to one shape: `is_owner() OR user_id = auth.uid()`,
with an extra account/job/loan-ownership `EXISTS` check on `INSERT`/`UPDATE`
for tables that carry a foreign key a PARTNER could otherwise attach to
someone else's row (`transactions.account_id`, `recurring_transactions.
account_id`, `job_shifts.job_id`, `loans.account_id`, `loan_repayments.
loan_id`). See `0008_rls_policies.sql` for the shared tables (`profiles`,
`accounts`, `transactions`, `jobs`, `job_shifts`, `payout_batches`) and the
self-contained RLS blocks at the bottom of `0010_recurring_transactions.sql`
and `0011_loans.sql` for those tables.

`loan_balances` is a view with `security_invoker = true` — it runs with the
querying user's own grants on `loans`/`loan_repayments`, not the view
owner's, so RLS still applies through it.

## Caching & performance architecture

Every `data.ts` fetcher across the four routes uses `'use cache: private'`
+ `cacheLife('seconds')` (30s client stale / 1s revalidate):

- **Why private, not plain `'use cache'`**: plain `use cache` can't call
  `cookies()`/`headers()` (which the Supabase server client needs for the
  session), and its result is a *shared* server-side cache — wrong for
  RLS-scoped per-user data. `'use cache: private'` is cached only in that
  browser's own memory, never written to a shared store — OWNER and
  PARTNER each just have their own independent in-memory cache, no
  cross-user leak surface at all.
- **Practical effect**: switching between Home/Work/Wallet/Loans and
  coming back within ~30s is instant — no network round trip. A hard
  reload always re-executes against Supabase fresh (private-cache
  functions are excluded from static-shell prerendering).

Every tag lives in `src/lib/cache-tags.ts` (`CACHE_TAGS`) and is set via
`cacheTag(...)` in the matching `data.ts` fetcher. Every mutating Server
Action calls `updateTag(...)` for exactly the tags the write touched — see
[why, not `revalidatePath`](./README.md#why-updatetag-not-revalidatepath-in-every-server-action)
in the README for the underlying Next.js limitation this works around. The
one Route Handler (`/api/wallet/quick-add`, needed for the offline queue —
`updateTag` only works inside Server Actions) uses `revalidateTag(tag, {
expire: 0 })` instead, for the same immediate read-your-own-writes effect.

| Tag | Set by | Invalidated by |
|---|---|---|
| `wallet-accounts` | `getWalletAccountsData` | `createAccount`, `createTransaction`, `settleJobPayout`, `markRecurringTransactionPaid`, `createLoan`, `repayLoan`, quick-add route |
| `wallet-transactions` | `getWalletTransactionsData`, `getWalletMonthTransactionsData` | same as above (except `createAccount`) |
| `recurring-transactions` | `getRecurringTransactionsData` | `createRecurringBill`, `markRecurringTransactionPaid`, `deactivateRecurringTransaction`, `createJob` (salaried) |
| `dashboard-accounts` | `getDashboardAccountsData` | same triggers as `wallet-accounts` |
| `dashboard-transactions` | `getDashboardTransactionsData` | same triggers as `wallet-transactions` |
| `dashboard-jobs` | `getDashboardJobsData` | `createJob`, `setJobActive`, `createJobShift`, `settleJobPayout`, `markRecurringTransactionPaid` |
| `dashboard-recurring` | `getDashboardRecurringData` | same triggers as `recurring-transactions` |
| `dashboard-loans` | `getDashboardLoanBalancesData` | `createLoan`, `repayLoan` |
| `work-jobs` | `getJobsData` | `createJob`, `setJobActive`, `createJobShift`, `settleJobPayout`, `markRecurringTransactionPaid`, `deactivateRecurringTransaction` |
| `work-payout-batches` | `getPayoutBatchesData` | `settleJobPayout` |
| `loans` | `getLoansData` | `createLoan`, `repayLoan` |

A few actions intentionally over-invalidate by one tag when they can't
cheaply tell which surface applies without an extra query (e.g.
`markRecurringTransactionPaid` always busts `work-jobs`/`dashboard-jobs`
too, since the row being paid might be a job-linked salary) — still far
more precise than the blanket `revalidatePath` it replaced.

Auth is also on the fast path: `proxy.ts`'s middleware already runs
`auth.getUser()` once per request (a real network round trip to Supabase)
to decide the login redirect gate. Rather than every page/action repeating
that same round trip, the middleware stamps the verified id onto a request
header (`x-vibesync-user-id`), and `getCurrentUser()`
(`src/lib/supabase/profile.ts`) reads that header instead — falling back to
a real `getUser()` call if the header is ever missing, so this is never
less correct, only usually faster. RLS remains the actual data-access
boundary regardless of this value either way.

## Offline quick-add architecture

The FAB opens a full-screen, amount-first keypad
(`src/components/wallet/quick-add-sheet.tsx`) that POSTs to
`/api/wallet/quick-add` — a plain fetch endpoint, not a Server Action,
specifically so it can be replayed later (a Server Action's encoded call
isn't something you can safely reconstruct and resend outside the original
page/transition).

If the device is offline (or the request fails), the entry is:

1. Shown immediately via React's `useOptimistic` (`transactions-provider.tsx`)
2. Queued in `localStorage` (`src/lib/offline-queue.ts`)
3. Flushed automatically on the next `online` event or app load
   (`src/components/pwa/offline-sync.tsx`)

This deliberately skips the Background Sync API — no support on iOS
Safari, which is most of this app's real usage, so a sync registration
would silently never fire there. Flush-on-reconnect covers the actual case
(phone regains signal while the app is open) without that platform gap.

## Dev workflow

```bash
npm run dev          # local dev server
npm run build         # production build (also type-checks)
npm run lint          # eslint
npm run seed          # idempotent — creates/updates both accounts + starter data
```

`public/sw.js`'s `CACHE_VERSION` is auto-stamped by
`scripts/inject-sw-version.ts` (a `postbuild` hook) with the real Next
build ID. The committed source has `"__CACHE_VERSION__"` as a placeholder
— seeing a real build id there after a local build is expected; reset it
back (or just don't commit a build artifact) before treating a diff as
clean.

## Resetting a partially applied schema

If a migration run was interrupted partway (or you're re-running against a
project that already has an earlier, partial attempt), the idempotent
`CREATE TYPE`/`CREATE TABLE IF NOT EXISTS` guards will silently skip
re-creating anything that already exists — even with the wrong shape. Since
a fresh project has no real data yet, the simplest fix is dropping every
object this app owns first, then re-running `supabase/migrations/*.sql` in
order:

```sql
drop table if exists public.loan_repayments cascade;
drop table if exists public.loans cascade;
drop view if exists public.loan_balances cascade;
drop table if exists public.recurring_transactions cascade;
drop table if exists public.payout_batches cascade;
drop table if exists public.job_shifts cascade;
drop table if exists public.jobs cascade;
drop table if exists public.transactions cascade;
drop table if exists public.accounts cascade;
drop table if exists public.profiles cascade;

drop function if exists public.repay_loan(uuid, numeric, date, uuid) cascade;
drop function if exists public.create_loan(uuid, text, loan_direction, numeric, date, date, text) cascade;
drop function if exists public.settle_job_shifts(uuid, date, text) cascade;
drop function if exists public.compute_job_shift_pay() cascade;
drop function if exists public.mark_recurring_transaction_paid(uuid, date) cascade;
drop function if exists public.add_calendar_month(date) cascade;
drop function if exists public.recalc_account_balance() cascade;
drop function if exists public.init_account_balance() cascade;
drop function if exists public.set_default_currency() cascade;
drop function if exists public.is_owner() cascade;
drop function if exists public.set_updated_at() cascade;

drop type if exists public.loan_direction cascade;
drop type if exists public.recurring_direction cascade;
drop type if exists public.recurring_frequency cascade;
drop type if exists public.expense_category cascade;
drop type if exists public.pay_type cascade;
drop type if exists public.employment_type cascade;
drop type if exists public.payout_status_type cascade;
drop type if exists public.transaction_type cascade;
drop type if exists public.account_type cascade;
drop type if exists public.profile_role cascade;
```

This only touches objects this app created — Supabase's own schema-level
grants, `auth.users`, storage, etc. are untouched.
