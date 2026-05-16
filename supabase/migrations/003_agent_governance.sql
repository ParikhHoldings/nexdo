-- Agent governance: scoped API keys and audit trail for external agent calls.

alter table profiles
  add column if not exists api_key_scopes text[] not null default array[
    'tasks:read',
    'tasks:write',
    'briefing:read'
  ],
  add column if not exists api_key_last_used_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_api_key_scopes_allowed'
  ) then
    alter table profiles
      add constraint profiles_api_key_scopes_allowed
      check (
        cardinality(api_key_scopes) > 0
        and api_key_scopes <@ array['tasks:read', 'tasks:write', 'briefing:read']::text[]
      );
  end if;
end $$;

create table if not exists agent_action_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  tool_name text not null,
  source_agent_id text,
  external_ref text,
  ingestion_intent text check (ingestion_intent in ('create', 'update', 'complete', 'auto')),
  metadata jsonb,
  success boolean not null default true,
  error text,
  duration_ms int,
  created_at timestamptz default now()
);

create index if not exists agent_action_events_user_created_idx
  on agent_action_events(user_id, created_at desc);

create index if not exists agent_action_events_user_tool_idx
  on agent_action_events(user_id, tool_name, created_at desc);

drop index if exists tasks_user_agent_external_ref_unique_idx;
create unique index tasks_user_agent_external_ref_unique_idx
  on tasks(user_id, source_agent_id, external_ref)
  where source_agent_id is not null
    and external_ref is not null;

alter table agent_action_events enable row level security;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'agent_action_events'
      and policyname = 'Users read own agent events'
  ) then
    create policy "Users read own agent events"
      on agent_action_events for select using (auth.uid() = user_id);
  end if;
end $$;
