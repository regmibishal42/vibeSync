-- Extensions & enum types shared across every table below.
create extension if not exists pgcrypto;

do $$ begin
  create type profile_role as enum ('ADMIN', 'PARTNER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_type as enum ('DIGITAL_WALLET', 'BANK', 'CASH');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transaction_type as enum ('EXPENSE', 'DEPOSIT', 'TRANSFER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type day_of_week_type as enum ('WEEKDAY', 'SATURDAY', 'SUNDAY');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payout_status_type as enum ('PENDING', 'PAID');
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
