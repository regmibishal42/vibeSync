-- loans: lend-to/borrow-from-a-person tracking. One row per loan event;
-- loan_repayments below tracks partial paydowns against it. Both directions
-- share one table (`direction` flips the sign everywhere) rather than two
-- separate "lent"/"borrowed" tables, since the settle/repay logic is
-- identical either way.
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  counterparty_name text not null,
  direction loan_direction not null,
  principal_amount numeric(14, 2) not null check (principal_amount > 0),
  loan_date date not null default current_date,
  due_date date,
  notes text,
  is_settled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loans_user_counterparty_idx on public.loans (user_id, counterparty_name);
create index if not exists loans_user_due_idx on public.loans (user_id, due_date) where not is_settled;

drop trigger if exists trg_loans_updated_at on public.loans;
create trigger trg_loans_updated_at
  before update on public.loans
  for each row execute function public.set_updated_at();

-- Tags the ledger row a loan/repayment posts, so the wallet's spending
-- analysis can exclude LOAN/REPAYMENT transactions by type without needing
-- a special expense_category value for them.
alter table public.transactions add column if not exists loan_id uuid references public.loans (id) on delete set null;
create index if not exists transactions_loan_id_idx on public.transactions (loan_id) where loan_id is not null;

-- loan_repayments: partial paydowns. transaction_id links back to the
-- ordinary ledger row each repayment posts (see repay_loan() below).
create table if not exists public.loan_repayments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  paid_date date not null default current_date,
  transaction_id uuid references public.transactions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists loan_repayments_loan_idx on public.loan_repayments (loan_id);

-- create_loan: records the money moving today as one ordinary signed
-- transaction (LENT = money leaves your account to a friend, negative;
-- BORROWED = money lands in your account from a friend, positive), typed
-- 'LOAN' and tagged with loan_id. user_id is derived from the account's
-- actual owner (not auth.uid()) — same "attribute to account owner, not
-- submitter" rule as transactions/recurring_transactions, so OWNER can
-- record a loan against PARTNER's account without it vanishing from her
-- own RLS-filtered view.
create or replace function public.create_loan(
  p_account_id uuid,
  p_counterparty_name text,
  p_direction loan_direction,
  p_principal_amount numeric,
  p_loan_date date default current_date,
  p_due_date date default null,
  p_notes text default null
)
returns public.loans
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid;
  v_loan public.loans;
  v_signed_amount numeric(14, 2);
begin
  select user_id into v_user_id from public.accounts where id = p_account_id;
  if v_user_id is null then
    raise exception 'Account % not found', p_account_id;
  end if;

  insert into public.loans (
    user_id, account_id, counterparty_name, direction, principal_amount, loan_date, due_date, notes
  ) values (
    v_user_id, p_account_id, p_counterparty_name, p_direction, p_principal_amount, p_loan_date, p_due_date, p_notes
  )
  returning * into v_loan;

  v_signed_amount := case when p_direction = 'LENT' then -abs(p_principal_amount) else abs(p_principal_amount) end;

  insert into public.transactions (
    account_id, user_id, amount, type, merchant_or_item, transaction_date, loan_id
  ) values (
    p_account_id, v_user_id, v_signed_amount, 'LOAN', p_counterparty_name, p_loan_date, v_loan.id
  );

  return v_loan;
end;
$$;

grant execute on function public.create_loan(uuid, text, loan_direction, numeric, date, date, text) to authenticated;

-- repay_loan: a repayment reverses the original direction (repaying a LENT
-- loan is money coming back to you; repaying a BORROWED loan is money going
-- back out) and auto-settles once repayments cover the principal.
-- p_account_id lets a repayment land somewhere other than where the loan
-- was originally lent/borrowed from — e.g. you lent cash out of your bank
-- account but a friend paid you back in physical cash — defaulting to the
-- loan's own account when omitted. Validated against v_loan.user_id (the
-- loan's actual owner), not auth.uid(), so this stays correct even when
-- OWNER is settling a PARTNER's loan: OWNER's own accounts must never be
-- silently usable as the landing spot for someone else's repayment.
create or replace function public.repay_loan(
  p_loan_id uuid,
  p_amount numeric,
  p_paid_date date default current_date,
  p_account_id uuid default null
)
returns public.loans
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_loan public.loans;
  v_target_account_id uuid;
  v_target_account_owner uuid;
  v_signed_amount numeric(14, 2);
  v_tx public.transactions;
  v_already_repaid numeric(14, 2);
  v_remaining numeric(14, 2);
begin
  if p_amount <= 0 then
    raise exception 'Repayment amount must be greater than 0';
  end if;

  select * into v_loan from public.loans where id = p_loan_id for update;
  if not found then
    raise exception 'Loan % not found', p_loan_id;
  end if;
  if v_loan.is_settled then
    raise exception 'Loan % is already settled', p_loan_id;
  end if;

  v_target_account_id := coalesce(p_account_id, v_loan.account_id);

  select user_id into v_target_account_owner
  from public.accounts where id = v_target_account_id;

  if v_target_account_owner is null then
    raise exception 'Account % not found', v_target_account_id;
  end if;
  if v_target_account_owner <> v_loan.user_id then
    raise exception 'Repayment account must belong to the loan''s own owner';
  end if;

  select coalesce(sum(amount), 0) into v_already_repaid
  from public.loan_repayments where loan_id = p_loan_id;
  v_remaining := v_loan.principal_amount - v_already_repaid;

  if p_amount > v_remaining then
    raise exception 'Repayment of % exceeds remaining balance of %', p_amount, v_remaining;
  end if;

  v_signed_amount := case when v_loan.direction = 'LENT' then abs(p_amount) else -abs(p_amount) end;

  insert into public.transactions (
    account_id, user_id, amount, type, merchant_or_item, transaction_date, loan_id
  ) values (
    v_target_account_id, v_loan.user_id, v_signed_amount, 'REPAYMENT', v_loan.counterparty_name, p_paid_date, v_loan.id
  )
  returning * into v_tx;

  insert into public.loan_repayments (loan_id, user_id, amount, paid_date, transaction_id)
  values (p_loan_id, v_loan.user_id, abs(p_amount), p_paid_date, v_tx.id);

  update public.loans
  set is_settled = (v_already_repaid + abs(p_amount) >= principal_amount), updated_at = now()
  where id = p_loan_id
  returning * into v_loan;

  return v_loan;
end;
$$;

grant execute on function public.repay_loan(uuid, numeric, date, uuid) to authenticated;

-- loan_balances: per-counterparty net position (positive = they owe you net,
-- negative = you owe them net) for the "who owes who" rollup. security_invoker
-- so it runs with the querying user's own RLS grants on loans/loan_repayments,
-- not the view owner's.
create or replace view public.loan_balances
with (security_invoker = true) as
select
  l.user_id,
  l.counterparty_name,
  sum(
    (case when l.direction = 'LENT' then 1 else -1 end) * (l.principal_amount - coalesce(r.repaid, 0))
  ) as net_outstanding,
  bool_or(not l.is_settled) as has_open_loans,
  max(l.due_date) as latest_due_date
from public.loans l
left join (
  select loan_id, sum(amount) as repaid from public.loan_repayments group by loan_id
) r on r.loan_id = l.id
group by l.user_id, l.counterparty_name;

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.loans enable row level security;

create policy loans_select on public.loans
  for select using (public.is_owner() or user_id = auth.uid());

create policy loans_insert on public.loans
  for insert with check (
    public.is_owner()
    or (
      user_id = auth.uid()
      and exists (
        select 1 from public.accounts a
        where a.id = loans.account_id and a.user_id = auth.uid()
      )
    )
  );

create policy loans_update on public.loans
  for update using (public.is_owner() or user_id = auth.uid())
  with check (public.is_owner() or user_id = auth.uid());

create policy loans_delete on public.loans
  for delete using (public.is_owner() or user_id = auth.uid());

alter table public.loan_repayments enable row level security;

create policy loan_repayments_select on public.loan_repayments
  for select using (public.is_owner() or user_id = auth.uid());

create policy loan_repayments_insert on public.loan_repayments
  for insert with check (
    public.is_owner()
    or (
      user_id = auth.uid()
      and exists (
        select 1 from public.loans l
        where l.id = loan_repayments.loan_id and l.user_id = auth.uid()
      )
    )
  );

create policy loan_repayments_delete on public.loan_repayments
  for delete using (public.is_owner() or user_id = auth.uid());
