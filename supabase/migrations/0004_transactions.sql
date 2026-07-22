-- transactions: signed ledger entries (positive = inflow, negative = outflow).
-- Signed amounts — rather than always-positive with a type-implied sign — are
-- what makes TRANSFER and "automatic real-time balance" actually work: a
-- transfer is just two ordinary rows (a negative leg on the source account,
-- a positive leg on the destination), and the balance trigger below never
-- needs to special-case the transaction type.
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(14, 2) not null,
  type transaction_type not null,
  category text,
  merchant_or_item text,
  transaction_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists transactions_account_id_idx on public.transactions (account_id);
create index if not exists transactions_user_date_idx on public.transactions (user_id, transaction_date desc);

-- Recomputes the affected account's current_balance from scratch
-- (starting_balance + sum of its transactions) after every write. Simpler
-- and less bug-prone than incrementing/decrementing in place, and cheap
-- enough at personal-finance-app volumes. SECURITY DEFINER because this is
-- system-derived data — a PARTNER row-owner's own UPDATE grant on her
-- account is enough for her real edits, but this trigger should never be
-- blocked by RLS nuances on the accounts table.
create or replace function public.recalc_account_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_account uuid;
begin
  target_account := case when tg_op = 'DELETE' then old.account_id else new.account_id end;

  update public.accounts
  set current_balance = starting_balance + coalesce(
        (select sum(amount) from public.transactions where account_id = target_account), 0
      ),
      updated_at = now()
  where id = target_account;

  if tg_op = 'UPDATE' and old.account_id is distinct from new.account_id then
    update public.accounts
    set current_balance = starting_balance + coalesce(
          (select sum(amount) from public.transactions where account_id = old.account_id), 0
        ),
        updated_at = now()
    where id = old.account_id;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_transactions_recalc_balance on public.transactions;
create trigger trg_transactions_recalc_balance
  after insert or update or delete on public.transactions
  for each row execute function public.recalc_account_balance();
