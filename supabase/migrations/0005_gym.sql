-- gym_exercises / gym_logs: ADMIN-only module end to end (see 0008 — these
-- two tables are gated to is_admin() on every operation, not just row
-- ownership, per the spec's "partner must never query gym records" rule).
create table if not exists public.gym_exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  target_muscle text,
  machine_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.gym_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.gym_exercises (id) on delete restrict,
  weight_kg numeric(6, 2) not null,
  reps integer not null,
  sets integer not null,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists gym_logs_user_exercise_idx
  on public.gym_logs (user_id, exercise_id, logged_at desc);
