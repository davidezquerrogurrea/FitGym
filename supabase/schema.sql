create extension if not exists pgcrypto;

create table if not exists public.workout_days (
  id uuid primary key default gen_random_uuid(),
  session_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_date)
);

create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.workout_days(id) on delete cascade,
  exercise_name text not null,
  exercise_order int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_number int not null,
  reps int not null check (reps > 0),
  weight_kg numeric(6,2) not null check (weight_kg >= 0),
  created_at timestamptz not null default now(),
  unique (exercise_id, set_number)
);

create index if not exists idx_workout_days_date
  on public.workout_days(session_date);

create index if not exists idx_workout_exercises_day
  on public.workout_exercises(day_id, exercise_order);

create index if not exists idx_workout_sets_exercise
  on public.workout_sets(exercise_id, set_number);
