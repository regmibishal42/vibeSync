-- recurring_transactions: schedules/templates for anything that repeats —
-- bills going out (EXPENSE, e.g. rent) or salary coming in (INCOME, e.g. a
-- MONTHLY/BIWEEKLY job's pay). Never itself a ledger entry — the real row
-- created by mark_recurring_transaction_paid() below is an ordinary
-- `transactions` row, so it hits the existing recalc_account_balance()
-- trigger and shows up in the normal transaction list like anything else.
do $$ begin
  create type recurring_frequency as enum ('WEEKLY', 'BIWEEKLY', 'MONTHLY');
exception when duplicate_object then null; end $$;

create table if not exists public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  direction recurring_direction not null default 'EXPENSE',
  label text not null,
  category expense_category,
  amount numeric(14, 2) not null check (amount > 0),
  frequency recurring_frequency not null,
  next_due_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_transactions_expense_requires_category
    check (direction <> 'EXPENSE' or category is not null)
);

create index if not exists recurring_transactions_user_due_idx
  on public.recurring_transactions (user_id, next_due_date)
  where is_active;

drop trigger if exists trg_recurring_transactions_updated_at on public.recurring_transactions;
create trigger trg_recurring_transactions_updated_at
  before update on public.recurring_transactions
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
-- next_due_date in one call. Sign/type flip on `direction`: INCOME posts a
-- positive DEPOSIT (e.g. salary landing), EXPENSE posts a negative EXPENSE
-- (e.g. rent going out) — a single Postgres function call is one implicit
-- transaction, so a partial failure can't double-post or silently drop a
-- payment record. SECURITY INVOKER: RLS on recurring_transactions/
-- transactions applies as the calling user, so a PARTNER can only ever
-- settle her own row; is_owner() lets OWNER settle either.
create or replace function public.mark_recurring_transaction_paid(
  p_recurring_id uuid,
  p_paid_date date default current_date
)
returns public.transactions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.recurring_transactions;
  v_next_due date;
  v_tx public.transactions;
  v_signed_amount numeric(14, 2);
begin
  select * into v_row from public.recurring_transactions where id = p_recurring_id for update;
  if not found then
    raise exception 'Recurring transaction % not found', p_recurring_id;
  end if;
  if not v_row.is_active then
    raise exception 'Recurring transaction % is not active', p_recurring_id;
  end if;

  v_signed_amount := case when v_row.direction = 'INCOME' then abs(v_row.amount) else -abs(v_row.amount) end;

  insert into public.transactions (
    account_id, user_id, amount, type, category, merchant_or_item, transaction_date, job_id
  ) values (
    v_row.account_id, v_row.user_id, v_signed_amount,
    case when v_row.direction = 'INCOME' then 'DEPOSIT' else 'EXPENSE' end,
    v_row.category, v_row.label, p_paid_date, v_row.job_id
  )
  returning * into v_tx;

  v_next_due := case v_row.frequency
    when 'WEEKLY' then v_row.next_due_date + interval '7 days'
    when 'BIWEEKLY' then v_row.next_due_date + interval '14 days'
    when 'MONTHLY' then public.add_calendar_month(v_row.next_due_date)
  end;

  update public.recurring_transactions
  set next_due_date = v_next_due, updated_at = now()
  where id = p_recurring_id;

  return v_tx;
end;
$$;

grant execute on function public.mark_recurring_transaction_paid(uuid, date) to authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Same shape as transactions' policies in 0008: an account-ownership guard
-- on insert/update in addition to the base is_owner()-or-owner check, since
-- recurring_transactions also carries an account_id FK a PARTNER could
-- otherwise attach to an account she doesn't own.
alter table public.recurring_transactions enable row level security;

create policy recurring_transactions_select on public.recurring_transactions
  for select using (public.is_owner() or user_id = auth.uid());

create policy recurring_transactions_insert on public.recurring_transactions
  for insert with check (
    public.is_owner()
    or (
      user_id = auth.uid()
      and exists (
        select 1 from public.accounts a
        where a.id = recurring_transactions.account_id and a.user_id = auth.uid()
      )
    )
  );

create policy recurring_transactions_update on public.recurring_transactions
  for update using (public.is_owner() or user_id = auth.uid())
  with check (
    public.is_owner()
    or (
      user_id = auth.uid()
      and exists (
        select 1 from public.accounts a
        where a.id = recurring_transactions.account_id and a.user_id = auth.uid()
      )
    )
  );

create policy recurring_transactions_delete on public.recurring_transactions
  for delete using (public.is_owner() or user_id = auth.uid());
