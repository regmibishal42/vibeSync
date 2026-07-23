-- recurring_bills: schedules/templates ("rent is due every 14 days"), never
-- themselves ledger entries — kept as a distinct noun from `transactions` so
-- there's no confusion between the two. The real ledger entry created by
-- mark_recurring_bill_paid() below is an ordinary `transactions` row, so it
-- hits the existing recalc_account_balance() trigger and shows up in the
-- normal transaction list like anything else.
--
-- Table + trigger + RLS are defined together in this one migration (rather
-- than a separate "0011 RLS" file matching 0008's split) since 0008 was a
-- one-time retrofit across tables that predated any RLS — for a table
-- created fresh, keeping it self-contained is the more standard approach.
do $$ begin
  create type recurring_frequency as enum ('WEEKLY', 'BIWEEKLY', 'MONTHLY');
exception when duplicate_object then null; end $$;

create table if not exists public.recurring_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  label text not null,
  category expense_category not null default 'OTHER',
  amount numeric(14, 2) not null check (amount > 0),
  frequency recurring_frequency not null,
  next_due_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_bills_user_due_idx
  on public.recurring_bills (user_id, next_due_date)
  where is_active;

drop trigger if exists trg_recurring_bills_updated_at on public.recurring_bills;
create trigger trg_recurring_bills_updated_at
  before update on public.recurring_bills
  for each row execute function public.set_updated_at();

-- Advances a date by one calendar month, clamped to the shorter month's
-- last day rather than overflowing (plain `date + interval '1 month'` does
-- NOT clamp — e.g. `date '2026-01-31' + interval '1 month'` yields
-- '2026-03-03', not '2026-02-28'). UNCERTAIN: verify this exact overflow
-- behavior in the Supabase SQL editor once a live project exists —
-- `select public.add_calendar_month(date '2026-01-31');` should return
-- '2026-02-28'.
create or replace function public.add_calendar_month(d date)
returns date
language sql
immutable
as $$
  select (
    date_trunc('month', d) + interval '1 month'
    + make_interval(days => least(
        extract(day from d)::int,
        extract(day from (date_trunc('month', d) + interval '2 month' - interval '1 day'))::int
      ) - 1)
  )::date;
$$;

-- Inserts the real ledger row (hits recalc_account_balance()) and advances
-- next_due_date in one call — a single Postgres function call is one
-- implicit transaction, which is stronger than the app's existing
-- createPayoutBatch() precedent (two sequential client-side Supabase calls,
-- accepted as non-atomic there since a partial failure just leaves a
-- manually-fixable status flag). Here a partial failure would either
-- double-charge the ledger or silently lose a payment record, so it's
-- worth the one Postgres function instead of replicating that pattern.
-- SECURITY INVOKER (not DEFINER): RLS on recurring_bills/transactions
-- applies as the calling user, so a PARTNER can only ever settle her own
-- bill; is_admin() lets the ADMIN settle either.
create or replace function public.mark_recurring_bill_paid(
  p_bill_id uuid,
  p_paid_date date default current_date
)
returns public.transactions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_bill public.recurring_bills;
  v_next_due date;
  v_tx public.transactions;
begin
  select * into v_bill from public.recurring_bills where id = p_bill_id for update;
  if not found then
    raise exception 'Recurring bill % not found', p_bill_id;
  end if;
  if not v_bill.is_active then
    raise exception 'Recurring bill % is not active', p_bill_id;
  end if;

  insert into public.transactions (
    account_id, user_id, amount, type, category, merchant_or_item, transaction_date
  ) values (
    v_bill.account_id, v_bill.user_id, -abs(v_bill.amount), 'EXPENSE',
    v_bill.category, v_bill.label, p_paid_date
  )
  returning * into v_tx;

  v_next_due := case v_bill.frequency
    when 'WEEKLY' then v_bill.next_due_date + interval '7 days'
    when 'BIWEEKLY' then v_bill.next_due_date + interval '14 days'
    when 'MONTHLY' then public.add_calendar_month(v_bill.next_due_date)
  end;

  update public.recurring_bills
  set next_due_date = v_next_due, updated_at = now()
  where id = p_bill_id;

  return v_tx;
end;
$$;

grant execute on function public.mark_recurring_bill_paid(uuid, date) to authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Same shape as transactions' policies in 0008: an account-ownership guard
-- on insert/update in addition to the base is_admin()-or-owner check, since
-- recurring_bills also carries an account_id FK a PARTNER could otherwise
-- attach to an account she doesn't own.
alter table public.recurring_bills enable row level security;

create policy recurring_bills_select on public.recurring_bills
  for select using (public.is_admin() or user_id = auth.uid());

create policy recurring_bills_insert on public.recurring_bills
  for insert with check (
    public.is_admin()
    or (
      user_id = auth.uid()
      and exists (
        select 1 from public.accounts a
        where a.id = recurring_bills.account_id and a.user_id = auth.uid()
      )
    )
  );

create policy recurring_bills_update on public.recurring_bills
  for update using (public.is_admin() or user_id = auth.uid())
  with check (
    public.is_admin()
    or (
      user_id = auth.uid()
      and exists (
        select 1 from public.accounts a
        where a.id = recurring_bills.account_id and a.user_id = auth.uid()
      )
    )
  );

create policy recurring_bills_delete on public.recurring_bills
  for delete using (public.is_admin() or user_id = auth.uid());
