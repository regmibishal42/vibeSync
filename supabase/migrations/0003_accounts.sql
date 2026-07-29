-- accounts: multi-account wallet system (digital wallets, banks, cash, and
-- flagged "parent" accounts that only the OWNER can ever own/see).
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_name text not null,
  account_type account_type not null,
  is_parent_account boolean not null default false,
  starting_balance numeric(14, 2) not null default 0,
  current_balance numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounts_user_id_idx on public.accounts (user_id);

-- A brand-new account has no transactions yet, so its running balance is
-- simply its starting balance. Every change after that is driven by the
-- transactions trigger in 0004.
create or replace function public.init_account_balance()
returns trigger
language plpgsql
as $$
begin
  new.current_balance := new.starting_balance;
  return new;
end;
$$;

drop trigger if exists trg_accounts_init_balance on public.accounts;
create trigger trg_accounts_init_balance
  before insert on public.accounts
  for each row execute function public.init_account_balance();

drop trigger if exists trg_accounts_updated_at on public.accounts;
create trigger trg_accounts_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();
