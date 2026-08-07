---
name: supabase-ops
description: Applying migrations and verifying behavior against this project's live Supabase project. Use whenever a change touches supabase/migrations/**, RLS policies, a Postgres function/RPC, or when a DB-backed behavior needs proving rather than assuming — and before claiming any schema change "works".
---

# Supabase operations for VibeSync

Everything here was learned the hard way against the real project. Read it
before hand-rolling a migration or "verifying" a DB change by inspection.

## Applying a migration

**The anon and service-role keys cannot run DDL.** This is a Supabase
security boundary, not a misconfiguration — don't burn time routing around
it:

- Management API (`api.supabase.com/.../database/query`) rejects the
  service-role key: `{"message":"JWT could not be decoded"}`. It wants a
  *personal access token*, which is a different credential entirely.
- PostgREST (`/rest/v1/`) only speaks table/RPC operations. No `CREATE`,
  no `ALTER`.

So a migration reaches the database exactly three ways:

1. **SQL Editor paste** (default, needs nothing extra) — concatenate the
   migration(s) to the scratchpad and have the user paste once.
2. **`psql`** — needs the database password (Project Settings → Database).
   `psql` is already installed on this machine.
3. **Supabase CLI** — `supabase link` + `db push`, needs
   `SUPABASE_ACCESS_TOKEN` or an interactive `supabase login`.

Ask which credential is available rather than assuming; don't stall the
whole task on it, and never paste secrets into files that get committed.

## Re-running after a partial failure

Every `create type` in this repo is wrapped in
`exception when duplicate_object then null`. That guard **silently skips a
type that already exists, even with the wrong values** — so an interrupted
run leaves a stale enum and the next attempt fails somewhere far away with a
confusing message (this actually happened: a leftover `profile_role` from an
`ADMIN`-era attempt made `0002` fail on `'OWNER'` being invalid).

The reliable fix is to drop this app's own objects and re-run the migrations
in order — but **that destroys all stored data, and this project now holds
real records** (see "Never bulk-delete" below). Treat a full reset as a
last resort requiring explicit confirmation from the user, not a routine
recovery step. The drop list lives in
`DOCUMENTATION.md#resetting-a-partially-applied-schema`; it touches only
objects this app created — never `auth.users`, storage, or Supabase's own
schema. Prefer repairing the specific broken object (a single `create or
replace function`, one `alter type`) over dropping everything.

## Verifying against the live database

Type-checking and reading SQL do not prove DB behavior. **Every genuine bug
found in this project so far lived in SQL semantics**, invisible to `tsc`:

- a `CASE` expression resolving to `text` where an enum was required, so
  `mark_recurring_transaction_paid` failed at runtime
- `init_account_balance()` being INSERT-only, so editing an opening balance
  left the running balance frozen
- `%` and `_` reaching `ILIKE` unescaped, so searching `50%` matched every row

Prove it. The pattern that works:

```bash
# 1. Real session tokens — RLS only applies under a genuine user JWT.
#    The service-role key bypasses RLS entirely and will make broken
#    isolation look fine, so never verify access control with it.
curl -sS -X POST "$URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"...","password":"..."}'

# 2. Query as that user
curl -sS "$URL/rest/v1/<table>?select=*" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $USER_JWT"

# 3. Call an RPC as that user
curl -sS -X POST "$URL/rest/v1/rpc/<fn>" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" -d '{"p_arg":"..."}'
```

Credentials live in `.env.local` (gitignored). For **isolation** changes,
always test from *both* accounts and assert the negative case — that the
other user genuinely cannot see the row — not just that the owner can.

Also exercise the guards, not only the happy path: over-payment, negative
amounts, already-settled rows, and cross-user targets should all be
*rejected*, and a passing test suite that never checks a rejection is not
evidence of anything.

## Testing through the running app

To verify the full stack (Server Actions, caching, route handlers), rebuild
and reconstruct a session cookie from a real login:

```python
# Supabase SSR cookie = "base64-" + base64(JSON session)
cookie = "base64-" + base64.b64encode(json.dumps(session, separators=(",",":")).encode()).decode()
# send as: sb-<project-ref>-auth-token=<cookie>
```

**Kill any server already on port 3000 first.** A stale `next start` from an
earlier run silently keeps serving an old build — this produced a
"0 rows created" result that looked like a serious bug and was purely a
stale-process artifact. `lsof -ti:3000 | xargs kill -9`, then confirm the
new server logged `✓ Ready` rather than `EADDRINUSE`.

Afterwards: stop the server and delete any temp files holding session
tokens. For test rows, follow "Never bulk-delete" below — delete the
specific ids you created, and only those.

## Never bulk-delete from this project

**This project holds real data.** Both accounts are in day-to-day use — the
PARTNER has entered real transactions, accounts, loans and jobs.

This rule exists because it was already broken once: three transactions
(`TRAVEL -11.00`, and an `Asmita` -50/+50 lend-and-repay pair) plus every
account were deleted during cleanup, on the assumption they were leftover
test rows. They were the user's own records, and they were not recoverable
from the session.

Before any `DELETE` against a live table:

1. **Select and read the rows first.** Print enough to identify them —
   including `created_at` and `user_id`, not just an amount.
2. **Delete by explicit id**, never `?id=not.is.null` or an unfiltered match.
3. **Tag test data unmistakably at creation** (a `ZZ_` name prefix, a
   dedicated throwaway account) so cleanup can target that prefix alone.
4. **If a row can't be positively identified as your own test artifact,
   leave it.** Orphaned test rows cost nothing; deleted user records are
   gone.

Note that `0012`'s trigger blocking deletion of an account that still has
transactions is a real safety net — deleting the transactions first defeats
it. Treat hitting that guard as a signal to stop, not an obstacle to route
around.

## Repo conventions

- Migrations are numbered and **edited in place** while no production data
  exists; there is no separate down-migration.
- `src/lib/types/database.types.ts` is hand-written and must mirror the SQL
  exactly. Adding a column or RPC means updating it in the same change, or
  `tsc` starts lying about the shape of your data.
- `public/sw.js`'s `CACHE_VERSION` is stamped by a `postbuild` hook with the
  real build ID. The committed source must read `"__CACHE_VERSION__"` —
  reset it after building, before treating a diff as clean.
- `npm run check` covers pure logic only (dates, formatting, escaping). It
  cannot see the database; it is not a substitute for the verification above.
