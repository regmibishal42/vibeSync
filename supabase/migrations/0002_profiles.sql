-- profiles: one row per auth.users row, exactly 2 rows in this app (ADMIN + PARTNER).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role profile_role not null,
  full_name text not null,
  currency_preference text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Default currency by role when the caller doesn't supply one explicitly.
-- A BEFORE trigger (not a column DEFAULT) because the default depends on
-- another column in the same row, which plain DEFAULT expressions can't do.
create or replace function public.set_default_currency()
returns trigger
language plpgsql
as $$
begin
  if new.currency_preference is null then
    new.currency_preference := case when new.role = 'ADMIN' then 'NPR' else 'AUD' end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_default_currency on public.profiles;
create trigger trg_profiles_default_currency
  before insert on public.profiles
  for each row execute function public.set_default_currency();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Central security helper used by every RLS policy in 0008. SECURITY DEFINER
-- + a fixed search_path so it can read profiles without recursing through
-- profiles' own RLS policy (which would otherwise call is_admin() again).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'ADMIN'
  );
$$;

grant execute on function public.is_admin() to authenticated;
