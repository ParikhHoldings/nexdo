-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Users/Profiles
create table profiles (
  id uuid references auth.users primary key,
  full_name text,
  timezone text default 'America/Chicago',
  work_type text check (work_type in ('founder', 'developer', 'marketer', 'student', 'other')),
  subscription_tier text default 'free' check (subscription_tier in ('free', 'pro', 'power', 'team')),
  stripe_customer_id text,
  api_key text unique,
  task_count_this_month int default 0,
  agent_executions_this_month int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tasks
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  raw_input text,
  description text,
  status text default 'todo' check (status in ('todo', 'in_progress', 'waiting', 'done', 'cancelled')),
  priority text default 'medium' check (priority in ('urgent', 'high', 'medium', 'low')),
  due_date date,
  due_time time,
  context text,
  source text default 'manual' check (source in ('manual', 'email', 'voice', 'api', 'agent')),
  action_type text default 'manual' check (action_type in ('manual', 'research', 'draft', 'prep', 'remind')),
  estimated_minutes int,
  energy_level text check (energy_level in ('deep', 'light', 'quick')),
  people text[],
  tags text[],
  parent_task_id uuid references tasks(id),
  related_task_ids uuid[],
  agent_output jsonb,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- Agent interop fields (Phase 2 MCP — architect for now)
  source_agent_id text,
  external_ref text,
  ingestion_intent text check (ingestion_intent in ('create', 'update', 'complete', 'auto')),
  agent_metadata jsonb
);

-- Task notes
create table task_notes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade not null,
  content text not null,
  note_type text default 'note' check (note_type in ('note', 'agent_result', 'link', 'file')),
  created_at timestamptz default now()
);

-- Daily briefings (cached)
create table daily_briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  briefing_date date not null,
  content jsonb not null,
  created_at timestamptz default now(),
  unique(user_id, briefing_date)
);

-- RLS
alter table profiles enable row level security;
alter table tasks enable row level security;
alter table task_notes enable row level security;
alter table daily_briefings enable row level security;

-- RLS Policies
create policy "Users read own profile" on profiles for select using (auth.uid() = id);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);
create policy "Users insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users read own tasks" on tasks for select using (auth.uid() = user_id);
create policy "Users insert own tasks" on tasks for insert with check (auth.uid() = user_id);
create policy "Users update own tasks" on tasks for update using (auth.uid() = user_id);
create policy "Users delete own tasks" on tasks for delete using (auth.uid() = user_id);
create policy "Users read own notes" on task_notes for select using (
  auth.uid() = (select user_id from tasks where id = task_id)
);
create policy "Users insert own notes" on task_notes for insert with check (
  auth.uid() = (select user_id from tasks where id = task_id)
);
create policy "Users read own briefings" on daily_briefings for select using (auth.uid() = user_id);
create policy "Users insert own briefings" on daily_briefings for insert with check (auth.uid() = user_id);

-- Indexes for performance
create index tasks_user_id_idx on tasks(user_id);
create index tasks_status_idx on tasks(status);
create index tasks_due_date_idx on tasks(due_date);
create index tasks_created_at_idx on tasks(created_at desc);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_updated_at before update on tasks
  for each row execute function update_updated_at();
create trigger profiles_updated_at before update on profiles
  for each row execute function update_updated_at();

-- Auto-create profile on user signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
