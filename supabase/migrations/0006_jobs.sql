-- jobs: generic income sources. Any number of jobs per user, each either
-- FULL_TIME/PART_TIME and paid HOURLY/MONTHLY/BIWEEKLY. Replaces the old
-- hardcoded hotel_shifts/secondary_shifts pair with one real model.
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  employment_type employment_type not null,
  pay_type pay_type not null,
  hourly_rate numeric(8, 2),
  deposit_account_id uuid references public.accounts (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_hourly_rate_required check (
    pay_type <> 'HOURLY' or hourly_rate is not null
  )
);

create index if not exists jobs_user_id_idx on public.jobs (user_id);

-- Tags every ledger row a job's income actually posts (hourly settlement
-- below, or a salary's recurring payment in 0010_recurring_transactions.sql)
-- so the dashboard's job-wise breakdown can join on job_id instead of
-- string-matching merchant_or_item against the job's name.
alter table public.transactions add column if not exists job_id uuid references public.jobs (id) on delete set null;
create index if not exists transactions_job_id_idx on public.transactions (job_id) where job_id is not null;

drop trigger if exists trg_jobs_updated_at on public.jobs;
create trigger trg_jobs_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- payout_batches: groups a job's PENDING job_shifts into one settlement —
-- the "reconcile once it hits the bank" flow, generalized from the old
-- hotel/secondary-only version to any hourly job.
create table if not exists public.payout_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  paid_at timestamptz not null default now(),
  total_amount numeric(10, 2) not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists payout_batches_job_idx on public.payout_batches (job_id);

-- job_shifts: hourly-job time entries. calculated_pay is trigger-derived
-- from the parent job's hourly_rate — never trusted from the client.
create table if not exists public.job_shifts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  shift_date date not null,
  hours_worked numeric(5, 2) not null check (hours_worked > 0),
  calculated_pay numeric(10, 2) not null default 0,
  payout_status payout_status_type not null default 'PENDING',
  payout_batch_id uuid references public.payout_batches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_shifts_user_date_idx on public.job_shifts (user_id, shift_date desc);
create index if not exists job_shifts_batch_idx on public.job_shifts (payout_batch_id);

create or replace function public.compute_job_shift_pay()
returns trigger
language plpgsql
as $$
declare
  v_rate numeric(8, 2);
  v_pay_type pay_type;
begin
  select hourly_rate, pay_type into v_rate, v_pay_type
  from public.jobs where id = new.job_id;

  if v_pay_type is distinct from 'HOURLY' then
    raise exception 'job_shifts can only be logged against an HOURLY job';
  end if;

  new.calculated_pay := round(new.hours_worked * v_rate, 2);
  return new;
end;
$$;

drop trigger if exists trg_job_shifts_compute_pay on public.job_shifts;
create trigger trg_job_shifts_compute_pay
  before insert or update of hours_worked, job_id on public.job_shifts
  for each row execute function public.compute_job_shift_pay();

drop trigger if exists trg_job_shifts_updated_at on public.job_shifts;
create trigger trg_job_shifts_updated_at
  before update on public.job_shifts
  for each row execute function public.set_updated_at();

-- settle_job_shifts: bundles every PENDING shift for a job into one
-- payout_batches row, flips them to PAID, and — unlike the old
-- createPayoutBatch() which only flipped a status flag — posts one real
-- wallet deposit transaction so hourly income actually shows up in balances.
-- SECURITY INVOKER: RLS on jobs/job_shifts/transactions applies as the
-- caller; is_owner() lets OWNER settle either job's batch.
create or replace function public.settle_job_shifts(
  p_job_id uuid,
  p_paid_date date default current_date,
  p_note text default null
)
returns public.payout_batches
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_job public.jobs;
  v_total numeric(10, 2);
  v_batch public.payout_batches;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then
    raise exception 'Job % not found', p_job_id;
  end if;

  select coalesce(sum(calculated_pay), 0) into v_total
  from public.job_shifts
  where job_id = p_job_id and payout_status = 'PENDING';

  if v_total <= 0 then
    raise exception 'No pending shifts to pay out for this job';
  end if;

  insert into public.payout_batches (user_id, job_id, paid_at, total_amount, note)
  values (v_job.user_id, p_job_id, p_paid_date, v_total, p_note)
  returning * into v_batch;

  update public.job_shifts
  set payout_status = 'PAID', payout_batch_id = v_batch.id
  where job_id = p_job_id and payout_status = 'PENDING';

  if v_job.deposit_account_id is not null then
    insert into public.transactions (
      account_id, user_id, amount, type, merchant_or_item, transaction_date, job_id
    ) values (
      v_job.deposit_account_id, v_job.user_id, v_total, 'DEPOSIT', v_job.name, p_paid_date, p_job_id
    );
  end if;

  return v_batch;
end;
$$;

grant execute on function public.settle_job_shifts(uuid, date, text) to authenticated;
