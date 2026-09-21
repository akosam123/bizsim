-- BizSim: accounts, progress, leaderboard and streaks.
--
-- Run this once in the Supabase SQL editor. It is idempotent, so re-running it
-- after an edit is safe.
--
-- Shape of the thing:
--   profiles       one row per player, created automatically on signup
--   runs           one row per playthrough
--   daily_records  one row per in-game day, per run: what the business made
--   leaderboard    a view ranking players by their best account balance
--
-- Every table has row level security on. A player can only read and write
-- their OWN rows; the leaderboard is the single deliberate exception, because
-- a world ranking is worthless if you can only see yourself.

-- ---------------------------------------------------------------- profiles --
create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 24),
  email        text,
  created_at   timestamptz not null default now(),
  -- streaks live here rather than in their own table: they are one small,
  -- always-needed fact about a player, and a join per leaderboard row to
  -- fetch two integers is not worth it
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_played_on date
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are readable by everyone" on public.profiles;
create policy "profiles are readable by everyone"
  on public.profiles for select using (true);

drop policy if exists "a player edits only their own profile" on public.profiles;
create policy "a player edits only their own profile"
  on public.profiles for update using (auth.uid() = id);

drop policy if exists "a player creates only their own profile" on public.profiles;
create policy "a player creates only their own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Display names are how players recognise each other on the board, so they
-- have to be unique. Case-insensitively, or "Frank" and "frank" are two people.
create unique index if not exists profiles_display_name_key
  on public.profiles (lower(display_name));

-- ------------------------------------------------------------------- runs --
create table if not exists public.runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  business    text not null,
  location    text not null,
  owner_name  text,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  -- denormalised so the leaderboard never has to scan daily_records
  best_cash   numeric not null default 0,
  final_cash  numeric,
  months      int not null default 0
);

alter table public.runs enable row level security;

drop policy if exists "runs are readable by everyone" on public.runs;
create policy "runs are readable by everyone"
  on public.runs for select using (true);

drop policy if exists "a player writes only their own runs" on public.runs;
create policy "a player writes only their own runs"
  on public.runs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists runs_user_idx on public.runs (user_id);

-- ---------------------------------------------------------- daily_records --
-- One row per in-game day. `game_day` is the day number within the run, so a
-- record is idempotent: replaying the same day overwrites rather than doubles.
create table if not exists public.daily_records (
  id          bigserial primary key,
  run_id      uuid not null references public.runs on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  game_day    int not null,
  game_month  int not null,
  revenue     numeric not null default 0,
  costs       numeric not null default 0,
  profit      numeric not null default 0,
  cash        numeric not null default 0,
  recorded_at timestamptz not null default now(),
  unique (run_id, game_day)
);

alter table public.daily_records enable row level security;

drop policy if exists "a player reads only their own records" on public.daily_records;
create policy "a player reads only their own records"
  on public.daily_records for select using (auth.uid() = user_id);

drop policy if exists "a player writes only their own records" on public.daily_records;
create policy "a player writes only their own records"
  on public.daily_records for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists daily_records_run_idx on public.daily_records (run_id, game_day);

-- ------------------------------------------------------------- leaderboard --
-- Ranked by the best balance a player has ever reached, not their current one,
-- so a single bad month doesn't erase a good run and players aren't punished
-- for continuing to play.
create or replace view public.leaderboard as
select
  p.id                                   as user_id,
  p.display_name,
  p.current_streak,
  p.longest_streak,
  coalesce(max(r.best_cash), 0)          as best_cash,
  count(r.id)                            as runs_played,
  rank() over (order by coalesce(max(r.best_cash), 0) desc) as rank
from public.profiles p
left join public.runs r on r.user_id = p.id
group by p.id, p.display_name, p.current_streak, p.longest_streak;

-- ------------------------------------------------------- signup + streaks --
-- A profile is created by a trigger rather than by the client, so a player can
-- never end up authenticated but profile-less if the app dies mid-signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    -- a placeholder the player renames on first launch; the suffix keeps the
    -- unique index happy when two people sign up from similar addresses
    coalesce(split_part(new.email, '@', 1), 'player') || '-' || substr(new.id::text, 1, 4),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Streaks are advanced server-side. Doing it on the client means a player can
-- run up a streak by changing their device clock.
create or replace function public.touch_streak()
returns table (current_streak int, longest_streak int)
language plpgsql
security definer set search_path = public
as $$
declare
  last date;
  cur  int;
  best int;
begin
  select p.last_played_on, p.current_streak, p.longest_streak
    into last, cur, best
    from public.profiles p where p.id = auth.uid()
    for update;

  if last = current_date then
    null;                                   -- already counted today
  elsif last = current_date - 1 then
    cur := cur + 1;                         -- consecutive day
  else
    cur := 1;                               -- first play, or the streak broke
  end if;

  best := greatest(coalesce(best, 0), cur);

  update public.profiles p
     set current_streak = cur,
         longest_streak = best,
         last_played_on = current_date
   where p.id = auth.uid();

  return query select cur, best;
end;
$$;
