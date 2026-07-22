-- Row Level Security. One shape repeats everywhere: `is_admin() OR user_id =
-- auth.uid()`. ADMIN always sees/edits everything; PARTNER only ever sees
-- her own rows. Two tables (gym_exercises, gym_logs) drop the ownership
-- half entirely and gate to is_admin() alone, because the gym module is
-- ADMIN-only end to end — the partner must never query gym records, not
-- just "won't find any because she owns none".

-- ── profiles ─────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select using (public.is_admin() or id = auth.uid());

create policy profiles_update on public.profiles
  for update using (public.is_admin() or id = auth.uid())
  with check (public.is_admin() or id = auth.uid());

-- No insert/delete policy for authenticated users on purpose: the only two
-- accounts in this app are created by scripts/seed.ts using the service-role
-- key, which bypasses RLS entirely. There is no public sign-up path.

-- ── accounts ─────────────────────────────────────────────────────────────
alter table public.accounts enable row level security;

create policy accounts_select on public.accounts
  for select using (public.is_admin() or user_id = auth.uid());

create policy accounts_insert on public.accounts
  for insert with check (public.is_admin() or user_id = auth.uid());

create policy accounts_update on public.accounts
  for update using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or user_id = auth.uid());

create policy accounts_delete on public.accounts
  for delete using (public.is_admin() or user_id = auth.uid());

-- ── transactions ─────────────────────────────────────────────────────────
-- INSERT/UPDATE additionally check that account_id actually belongs to the
-- caller (for non-admins) — otherwise a PARTNER could attach a transaction
-- to an ADMIN or parent account, since her own user_id would already
-- satisfy the basic ownership half of the check.
alter table public.transactions enable row level security;

create policy transactions_select on public.transactions
  for select using (public.is_admin() or user_id = auth.uid());

create policy transactions_insert on public.transactions
  for insert with check (
    public.is_admin()
    or (
      user_id = auth.uid()
      and exists (
        select 1 from public.accounts a
        where a.id = transactions.account_id and a.user_id = auth.uid()
      )
    )
  );

create policy transactions_update on public.transactions
  for update using (public.is_admin() or user_id = auth.uid())
  with check (
    public.is_admin()
    or (
      user_id = auth.uid()
      and exists (
        select 1 from public.accounts a
        where a.id = transactions.account_id and a.user_id = auth.uid()
      )
    )
  );

create policy transactions_delete on public.transactions
  for delete using (public.is_admin() or user_id = auth.uid());

-- ── gym_exercises / gym_logs (ADMIN-only, no ownership fallback) ─────────
alter table public.gym_exercises enable row level security;

create policy gym_exercises_all on public.gym_exercises
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.gym_logs enable row level security;

create policy gym_logs_all on public.gym_logs
  for all using (public.is_admin()) with check (public.is_admin());

-- ── hotel_shifts ─────────────────────────────────────────────────────────
alter table public.hotel_shifts enable row level security;

create policy hotel_shifts_select on public.hotel_shifts
  for select using (public.is_admin() or user_id = auth.uid());

create policy hotel_shifts_insert on public.hotel_shifts
  for insert with check (public.is_admin() or user_id = auth.uid());

create policy hotel_shifts_update on public.hotel_shifts
  for update using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or user_id = auth.uid());

create policy hotel_shifts_delete on public.hotel_shifts
  for delete using (public.is_admin() or user_id = auth.uid());

-- ── secondary_shifts ─────────────────────────────────────────────────────
alter table public.secondary_shifts enable row level security;

create policy secondary_shifts_select on public.secondary_shifts
  for select using (public.is_admin() or user_id = auth.uid());

create policy secondary_shifts_insert on public.secondary_shifts
  for insert with check (public.is_admin() or user_id = auth.uid());

create policy secondary_shifts_update on public.secondary_shifts
  for update using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or user_id = auth.uid());

create policy secondary_shifts_delete on public.secondary_shifts
  for delete using (public.is_admin() or user_id = auth.uid());

-- ── payout_batches ───────────────────────────────────────────────────────
alter table public.payout_batches enable row level security;

create policy payout_batches_select on public.payout_batches
  for select using (public.is_admin() or user_id = auth.uid());

create policy payout_batches_insert on public.payout_batches
  for insert with check (public.is_admin() or user_id = auth.uid());

create policy payout_batches_update on public.payout_batches
  for update using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or user_id = auth.uid());

create policy payout_batches_delete on public.payout_batches
  for delete using (public.is_admin() or user_id = auth.uid());
