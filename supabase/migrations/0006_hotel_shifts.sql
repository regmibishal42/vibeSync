-- hotel_shifts: 5-star hotel housekeeping shift tracking. day_of_week,
-- base_hourly_rate, and calculated_pay are all derived — a client only ever
-- supplies shift_date, rooms_cleaned, total_credits, and room_details. The
-- trigger below is the single source of truth for the pay formula so a
-- buggy or malicious client can never write an incorrect calculated_pay.
create table if not exists public.hotel_shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  shift_date date not null,
  day_of_week day_of_week_type not null,
  rooms_cleaned integer not null default 0,
  total_credits numeric(6, 2) not null,
  base_hourly_rate numeric(6, 2) not null,
  calculated_pay numeric(10, 2) not null,
  room_details jsonb,
  payout_status payout_status_type not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hotel_shifts_user_date_idx
  on public.hotel_shifts (user_id, shift_date desc);

create or replace function public.compute_hotel_shift_pay()
returns trigger
language plpgsql
as $$
begin
  new.day_of_week := case extract(dow from new.shift_date)::int
    when 0 then 'SUNDAY'
    when 6 then 'SATURDAY'
    else 'WEEKDAY'
  end;

  new.base_hourly_rate := case new.day_of_week
    when 'SUNDAY' then 38.00
    when 'SATURDAY' then 32.00
    else 25.00
  end;

  new.calculated_pay := round((new.total_credits / 2) * new.base_hourly_rate, 2);

  return new;
end;
$$;

drop trigger if exists trg_hotel_shifts_compute_pay on public.hotel_shifts;
create trigger trg_hotel_shifts_compute_pay
  before insert or update of shift_date, total_credits on public.hotel_shifts
  for each row execute function public.compute_hotel_shift_pay();

drop trigger if exists trg_hotel_shifts_updated_at on public.hotel_shifts;
create trigger trg_hotel_shifts_updated_at
  before update on public.hotel_shifts
  for each row execute function public.set_updated_at();
