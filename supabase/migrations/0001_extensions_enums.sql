-- Extensions & enum types shared across every table below.
create extension if not exists pgcrypto;

do $$ begin
  create type profile_role as enum ('OWNER', 'PARTNER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_type as enum ('DIGITAL_WALLET', 'BANK', 'CASH');
exception when duplicate_object then null; end $$;

-- LOAN/REPAYMENT are their own types (not folded into EXPENSE/DEPOSIT) so
-- lending/borrowing never pollutes expense-category spending analysis while
-- still showing up as ordinary signed ledger rows.
do $$ begin
  create type transaction_type as enum ('EXPENSE', 'DEPOSIT', 'TRANSFER', 'LOAN', 'REPAYMENT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payout_status_type as enum ('PENDING', 'PAID');
exception when duplicate_object then null; end $$;

do $$ begin
  create type employment_type as enum ('FULL_TIME', 'PART_TIME');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pay_type as enum ('HOURLY', 'MONTHLY', 'BIWEEKLY');
exception when duplicate_object then null; end $$;

do $$ begin
  create type recurring_direction as enum ('INCOME', 'EXPENSE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type loan_direction as enum ('LENT', 'BORROWED');
exception when duplicate_object then null; end $$;

-- Reusable "touch updated_at" trigger for every table that has the column.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
