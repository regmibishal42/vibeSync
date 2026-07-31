-- Strict per-user isolation.
--
-- Until now every policy read `is_owner() OR user_id = auth.uid()`, so the
-- OWNER could read and write the PARTNER's accounts, ledger, jobs and loans.
-- That is now deliberately removed: each person sees only their own data,
-- full stop. The single cross-user capability the OWNER keeps is resetting
-- the PARTNER's password, which happens through the service-role admin API
-- in a Server Action — never through RLS, and never in the browser.
--
-- `is_owner()` itself is kept: it still gates the profiles read below (the
-- password screen needs the other person's name) and the app checks it
-- server-side before allowing a password reset.

-- ── profiles ─────────────────────────────────────────────────────────────
-- The one intentional exception. A profile row is a name, a role and a
-- currency preference — no financial data — and the OWNER needs to render
-- "reset <name>'s password". Writes stay self-only so the OWNER cannot
-- rename or re-role the PARTNER.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (public.is_owner() or id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- ── accounts ─────────────────────────────────────────────────────────────
drop policy if exists accounts_select on public.accounts;
create policy accounts_select on public.accounts
  for select using (user_id = auth.uid());

drop policy if exists accounts_insert on public.accounts;
create policy accounts_insert on public.accounts
  for insert with check (user_id = auth.uid());

drop policy if exists accounts_update on public.accounts;
create policy accounts_update on public.accounts
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists accounts_delete on public.accounts;
create policy accounts_delete on public.accounts
  for delete using (user_id = auth.uid());

-- ── transactions ─────────────────────────────────────────────────────────
-- The account-ownership EXISTS guard stays on write: user_id = auth.uid()
-- alone would still let someone attach a row to an account they don't own.
drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions
  for select using (user_id = auth.uid());

drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert on public.transactions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.accounts a
      where a.id = transactions.account_id and a.user_id = auth.uid()
    )
  );

drop policy if exists transactions_update on public.transactions;
create policy transactions_update on public.transactions
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.accounts a
      where a.id = transactions.account_id and a.user_id = auth.uid()
    )
  );

drop policy if exists transactions_delete on public.transactions;
create policy transactions_delete on public.transactions
  for delete using (user_id = auth.uid());

-- ── jobs ─────────────────────────────────────────────────────────────────
drop policy if exists jobs_select on public.jobs;
create policy jobs_select on public.jobs
  for select using (user_id = auth.uid());

drop policy if exists jobs_insert on public.jobs;
create policy jobs_insert on public.jobs
  for insert with check (
    user_id = auth.uid()
    and (
      deposit_account_id is null
      or exists (
        select 1 from public.accounts a
        where a.id = jobs.deposit_account_id and a.user_id = auth.uid()
      )
    )
  );

drop policy if exists jobs_update on public.jobs;
create policy jobs_update on public.jobs
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      deposit_account_id is null
      or exists (
        select 1 from public.accounts a
        where a.id = jobs.deposit_account_id and a.user_id = auth.uid()
      )
    )
  );

drop policy if exists jobs_delete on public.jobs;
create policy jobs_delete on public.jobs
  for delete using (user_id = auth.uid());

-- ── job_shifts ───────────────────────────────────────────────────────────
drop policy if exists job_shifts_select on public.job_shifts;
create policy job_shifts_select on public.job_shifts
  for select using (user_id = auth.uid());

drop policy if exists job_shifts_insert on public.job_shifts;
create policy job_shifts_insert on public.job_shifts
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.jobs j
      where j.id = job_shifts.job_id and j.user_id = auth.uid()
    )
  );

drop policy if exists job_shifts_update on public.job_shifts;
create policy job_shifts_update on public.job_shifts
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.jobs j
      where j.id = job_shifts.job_id and j.user_id = auth.uid()
    )
  );

drop policy if exists job_shifts_delete on public.job_shifts;
create policy job_shifts_delete on public.job_shifts
  for delete using (user_id = auth.uid());

-- ── payout_batches ───────────────────────────────────────────────────────
drop policy if exists payout_batches_select on public.payout_batches;
create policy payout_batches_select on public.payout_batches
  for select using (user_id = auth.uid());

drop policy if exists payout_batches_insert on public.payout_batches;
create policy payout_batches_insert on public.payout_batches
  for insert with check (user_id = auth.uid());

drop policy if exists payout_batches_update on public.payout_batches;
create policy payout_batches_update on public.payout_batches
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists payout_batches_delete on public.payout_batches;
create policy payout_batches_delete on public.payout_batches
  for delete using (user_id = auth.uid());

-- ── recurring_transactions ───────────────────────────────────────────────
drop policy if exists recurring_transactions_select on public.recurring_transactions;
create policy recurring_transactions_select on public.recurring_transactions
  for select using (user_id = auth.uid());

drop policy if exists recurring_transactions_insert on public.recurring_transactions;
create policy recurring_transactions_insert on public.recurring_transactions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.accounts a
      where a.id = recurring_transactions.account_id and a.user_id = auth.uid()
    )
  );

drop policy if exists recurring_transactions_update on public.recurring_transactions;
create policy recurring_transactions_update on public.recurring_transactions
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.accounts a
      where a.id = recurring_transactions.account_id and a.user_id = auth.uid()
    )
  );

drop policy if exists recurring_transactions_delete on public.recurring_transactions;
create policy recurring_transactions_delete on public.recurring_transactions
  for delete using (user_id = auth.uid());

-- ── loans / loan_repayments ──────────────────────────────────────────────
drop policy if exists loans_select on public.loans;
create policy loans_select on public.loans
  for select using (user_id = auth.uid());

drop policy if exists loans_insert on public.loans;
create policy loans_insert on public.loans
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.accounts a
      where a.id = loans.account_id and a.user_id = auth.uid()
    )
  );

drop policy if exists loans_update on public.loans;
create policy loans_update on public.loans
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists loans_delete on public.loans;
create policy loans_delete on public.loans
  for delete using (user_id = auth.uid());

drop policy if exists loan_repayments_select on public.loan_repayments;
create policy loan_repayments_select on public.loan_repayments
  for select using (user_id = auth.uid());

drop policy if exists loan_repayments_insert on public.loan_repayments;
create policy loan_repayments_insert on public.loan_repayments
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.loans l
      where l.id = loan_repayments.loan_id and l.user_id = auth.uid()
    )
  );

drop policy if exists loan_repayments_delete on public.loan_repayments;
create policy loan_repayments_delete on public.loan_repayments
  for delete using (user_id = auth.uid());

-- ── Keyset-pagination index ──────────────────────────────────────────────
-- The ledger pages on (transaction_date desc, id desc); the existing index
-- stops at transaction_date, so the tiebreaker would fall back to a sort.
create index if not exists transactions_user_date_id_idx
  on public.transactions (user_id, transaction_date desc, id desc);

-- ── Dashboard aggregation, in SQL ────────────────────────────────────────
-- The dashboard used to fetch 90 days of every transaction and reduce it in
-- JavaScript. With ranges now reaching a full year that is a lot of JSON to
-- ship in order to render about eight numbers, so the aggregation happens
-- where the data already lives and only the totals travel.
--
-- Bounds are timestamptz, passed by the client as the true start/end of the
-- range *in the viewer's own timezone* — deriving them from a bare date here
-- would silently use the server's zone and put boundary-day transactions in
-- the wrong bucket.
--
-- Parent accounts are excluded throughout: that money is administered, not
-- owned (matching net worth and the wallet's separate section for them).
create or replace function public.dashboard_summary(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language sql
security invoker
stable
set search_path = public
as $$
  with scoped as (
    select t.amount, t.type, t.category, t.job_id, a.account_name
    from public.transactions t
    join public.accounts a on a.id = t.account_id
    where t.user_id = auth.uid()
      and not a.is_parent_account
      and t.transaction_date >= p_from
      and t.transaction_date <= p_to
  ),
  totals as (
    select
      coalesce(sum(amount) filter (where amount > 0), 0) as income,
      coalesce(-sum(amount) filter (where amount < 0), 0) as expense
    from scoped
  ),
  by_category as (
    select coalesce(jsonb_agg(jsonb_build_object('label', category, 'amount', total)
                              order by total desc), '[]'::jsonb) as data
    from (
      select category::text as category, -sum(amount) as total
      from scoped
      where type = 'EXPENSE' and category is not null
      group by category
      having -sum(amount) > 0
    ) c
  ),
  by_account as (
    select coalesce(jsonb_agg(jsonb_build_object('label', account_name, 'amount', total)
                              order by abs(total) desc), '[]'::jsonb) as data
    from (
      select account_name, sum(amount) as total
      from scoped
      group by account_name
      having sum(amount) <> 0
    ) b
  ),
  -- Hourly jobs are measured by the shifts worked in the range; salaried
  -- jobs by the pay actually deposited. Counting both for an hourly job
  -- would double it — a settled shift keeps its calculated_pay *and* has a
  -- settlement deposit tagged with the same job_id.
  by_job as (
    select coalesce(jsonb_agg(jsonb_build_object('label', name, 'amount', total)
                              order by total desc), '[]'::jsonb) as data
    from (
      select j.name, sum(s.calculated_pay) as total
      from public.job_shifts s
      join public.jobs j on j.id = s.job_id
      where s.user_id = auth.uid()
        and j.pay_type = 'HOURLY'
        and s.shift_date >= p_from::date
        and s.shift_date <= p_to::date
      group by j.name
      having sum(s.calculated_pay) > 0

      union all

      select j.name, sum(t.amount) as total
      from scoped t
      join public.jobs j on j.id = t.job_id
      where t.type = 'DEPOSIT' and j.pay_type <> 'HOURLY'
      group by j.name
      having sum(t.amount) > 0
    ) g
  )
  select jsonb_build_object(
    'income', totals.income,
    'expense', totals.expense,
    'byCategory', by_category.data,
    'byAccount', by_account.data,
    'byJob', by_job.data
  )
  from totals, by_category, by_account, by_job;
$$;

grant execute on function public.dashboard_summary(timestamptz, timestamptz) to authenticated;
