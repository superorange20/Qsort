-- Qsort MSO exam cloud storage
-- Run this script in Supabase SQL Editor.

create table if not exists public.exam_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  paper_id integer not null check (paper_id between 1 and 6),
  state jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, paper_id)
);

create table if not exists public.exam_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paper_id integer not null check (paper_id between 1 and 6),
  paper_name text not null,
  score integer not null check (score between 0 and 35),
  passed boolean not null,
  module_results jsonb not null default '[]'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now(),
  source_key text not null,
  unique (user_id, source_key)
);

create index if not exists exam_history_user_completed_idx
  on public.exam_history (user_id, completed_at desc);

alter table public.exam_states enable row level security;
alter table public.exam_history enable row level security;

-- Grant table privileges to signed-in users. RLS policies below still
-- restrict every row to auth.uid() = user_id.
grant select, insert, update, delete on table public.exam_states to authenticated;
grant select, insert, delete on table public.exam_history to authenticated;


drop policy if exists "Users can read their own exam states" on public.exam_states;
create policy "Users can read their own exam states"
  on public.exam_states for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own exam states" on public.exam_states;
create policy "Users can insert their own exam states"
  on public.exam_states for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own exam states" on public.exam_states;
create policy "Users can update their own exam states"
  on public.exam_states for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own exam states" on public.exam_states;
create policy "Users can delete their own exam states"
  on public.exam_states for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read their own exam history" on public.exam_history;
create policy "Users can read their own exam history"
  on public.exam_history for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own exam history" on public.exam_history;
create policy "Users can insert their own exam history"
  on public.exam_history for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own exam history" on public.exam_history;
create policy "Users can delete their own exam history"
  on public.exam_history for delete to authenticated
  using (auth.uid() = user_id);
