-- Row Level Security. One shape repeats everywhere: `is_owner() OR user_id =
-- auth.uid()`. OWNER always sees/edits everything; PARTNER only ever sees
-- her own rows. (loans/recurring_transactions get their own self-contained
-- RLS blocks in 0010/0011 since those tables were created fresh there.)

-- ── profiles ─────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select using (public.is_owner() or id = auth.uid());

create policy profiles_update on public.profiles
  for update using (public.is_owner() or id = auth.uid())
  with check (public.is_owner() or id = auth.uid());

-- No insert/delete policy for authenticated users on purpose: the only two
-- accounts in this app are created by scripts/seed.ts using the service-role
-- key, which bypasses RLS entirely. There is no public sign-up path.

-- ── accounts ─────────────────────────────────────────────────────────────
alter table public.accounts enable row level security;

create policy accounts_select on public.accounts
  for select using (public.is_owner() or user_id = auth.uid());

create policy accounts_insert on public.accounts
  for insert with check (public.is_owner() or user_id = auth.uid());

create policy accounts_update on public.accounts
  for update using (public.is_owner() or user_id = auth.uid())
  with check (public.is_owner() or user_id = auth.uid());

create policy accounts_delete on public.accounts
  for delete using (public.is_owner() or user_id = auth.uid());

-- ── transactions ─────────────────────────────────────────────────────────
-- INSERT/UPDATE additionally check that account_id actually belongs to the
-- caller (for non-owners) — otherwise a PARTNER could attach a transaction
-- to an OWNER or parent account, since her own user_id would already
-- satisfy the basic ownership half of the check.
alter table public.transactions enable row level security;

create policy transactions_select on public.transactions
  for select using (public.is_owner() or user_id = auth.uid());

create policy transactions_insert on public.transactions
  for insert with check (
    public.is_owner()
    or (
      user_id = auth.uid()
      and exists (
        select 1 from public.accounts a
        where a.id = transactions.account_id and a.user_id = auth.uid()
      )
    )
  );

create policy transactions_update on public.transactions
  for update using (public.is_owner() or user_id = auth.uid())
  with check (
    public.is_owner()
    or (
      user_id = auth.uid()
      and exists (
        select 1 from public.accounts a
        where a.id = transactions.account_id and a.user_id = auth.uid()
      )
    )
  );

create policy transactions_delete on public.transactions
  for delete using (public.is_owner() or user_id = auth.uid());

-- ── jobs ─────────────────────────────────────────────────────────────────
alter table public.jobs enable row level security;

create policy jobs_select on public.jobs
  for select using (public.is_owner() or user_id = auth.uid());

create policy jobs_insert on public.jobs
  for insert with check (
    public.is_owner()
    or (
      user_id = auth.uid()
      and (
        deposit_account_id is null
        or exists (
          select 1 from public.accounts a
          where a.id = jobs.deposit_account_id and a.user_id = auth.uid()
        )
      )
    )
  );

create policy jobs_update on public.jobs
  for update using (public.is_owner() or user_id = auth.uid())
  with check (
    public.is_owner()
    or (
      user_id = auth.uid()
      and (
        deposit_account_id is null
        or exists (
          select 1 from public.accounts a
          where a.id = jobs.deposit_account_id and a.user_id = auth.uid()
        )
      )
    )
  );

create policy jobs_delete on public.jobs
  for delete using (public.is_owner() or user_id = auth.uid());

-- ── job_shifts ───────────────────────────────────────────────────────────
alter table public.job_shifts enable row level security;

create policy job_shifts_select on public.job_shifts
  for select using (public.is_owner() or user_id = auth.uid());

create policy job_shifts_insert on public.job_shifts
  for insert with check (
    public.is_owner()
    or (
      user_id = auth.uid()
      and exists (
        select 1 from public.jobs j
        where j.id = job_shifts.job_id and j.user_id = auth.uid()
      )
    )
  );

create policy job_shifts_update on public.job_shifts
  for update using (public.is_owner() or user_id = auth.uid())
  with check (
    public.is_owner()
    or (
      user_id = auth.uid()
      and exists (
        select 1 from public.jobs j
        where j.id = job_shifts.job_id and j.user_id = auth.uid()
      )
    )
  );

create policy job_shifts_delete on public.job_shifts
  for delete using (public.is_owner() or user_id = auth.uid());

-- ── payout_batches ───────────────────────────────────────────────────────
alter table public.payout_batches enable row level security;

create policy payout_batches_select on public.payout_batches
  for select using (public.is_owner() or user_id = auth.uid());

create policy payout_batches_insert on public.payout_batches
  for insert with check (public.is_owner() or user_id = auth.uid());

create policy payout_batches_update on public.payout_batches
  for update using (public.is_owner() or user_id = auth.uid())
  with check (public.is_owner() or user_id = auth.uid());

create policy payout_batches_delete on public.payout_batches
  for delete using (public.is_owner() or user_id = auth.uid());
