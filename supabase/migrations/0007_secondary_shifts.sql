-- payout_batches: a small additive table (not in the original sketch) that
-- gives "reconcile pending shifts once salary hits her account" an actual
-- target to reconcile against, instead of just a status flag.
create table if not exists public.payout_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  paid_at timestamptz not null default now(),
  total_amount numeric(10, 2) not null default 0,
  note text,
  created_at timestamptz not null default now()
);

-- secondary_shifts: the 2-hour daily secondary job. calculated_pay is
-- derived the same way hotel_shifts.calculated_pay is — trigger-computed,
-- never trusted from the client.
create table if not exists public.secondary_shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  shift_date date not null,
  hours_worked numeric(4, 2) not null default 2.0,
  hourly_rate numeric(6, 2) not null default 25.00,
  calculated_pay numeric(10, 2) not null,
  payout_status payout_status_type not null default 'PENDING',
  payout_batch_id uuid references public.payout_batches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists secondary_shifts_user_date_idx
  on public.secondary_shifts (user_id, shift_date desc);
create index if not exists secondary_shifts_batch_idx
  on public.secondary_shifts (payout_batch_id);

create or replace function public.compute_secondary_shift_pay()
returns trigger
language plpgsql
as $$
begin
  new.calculated_pay := round(new.hours_worked * new.hourly_rate, 2);
  return new;
end;
$$;

drop trigger if exists trg_secondary_shifts_compute_pay on public.secondary_shifts;
create trigger trg_secondary_shifts_compute_pay
  before insert or update of hours_worked, hourly_rate on public.secondary_shifts
  for each row execute function public.compute_secondary_shift_pay();

drop trigger if exists trg_secondary_shifts_updated_at on public.secondary_shifts;
create trigger trg_secondary_shifts_updated_at
  before update on public.secondary_shifts
  for each row execute function public.set_updated_at();
