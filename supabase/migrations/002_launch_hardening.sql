-- Launch hardening: quota tracking, rate limiting, webhook idempotency
-- Adds accountability layer on top of the existing counters without
-- changing the contract of profiles.task_count_this_month /
-- agent_executions_this_month (which remain the authoritative counters).

-- 1) Track when the current usage period started so we can reset counters
--    on first request in a new calendar month (UTC).
alter table profiles
  add column if not exists current_period_start timestamptz default date_trunc('month', now());

-- 2) Usage events (append-only audit log of quota-consuming actions).
create table if not exists usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  event_type text not null check (event_type in ('task_create', 'agent_execute', 'ai_parse', 'ai_briefing', 'ai_prioritize', 'import_task')),
  quantity int not null default 1,
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists usage_events_user_id_created_idx
  on usage_events(user_id, created_at desc);

alter table usage_events enable row level security;
create policy "Users read own usage" on usage_events for select using (auth.uid() = user_id);

-- 3) Rate limiting buckets (per user+endpoint, sliding window via last_reset).
create table if not exists rate_limits (
  user_id uuid references profiles(id) on delete cascade not null,
  bucket text not null,
  count int not null default 0,
  window_start timestamptz not null default now(),
  primary key (user_id, bucket)
);

alter table rate_limits enable row level security;
-- Rate limits are only read/written by the service role inside the API layer;
-- no client policies needed.

-- 4) Stripe webhook idempotency. Stripe retries, so we must not double-apply.
create table if not exists stripe_events (
  id text primary key,              -- Stripe event id (evt_...)
  type text not null,
  processed_at timestamptz default now()
);

-- 5) Atomic quota increment + reset helper. Called from the API layer via
--    the service-role client so RLS doesn't need a policy for it.
create or replace function increment_usage(
  p_user_id uuid,
  p_event_type text,
  p_quantity int default 1
) returns table (
  task_count_this_month int,
  agent_executions_this_month int,
  current_period_start timestamptz
) language plpgsql security definer as $$
declare
  this_period timestamptz := date_trunc('month', now());
begin
  -- Reset counters if we've crossed a month boundary.
  update profiles
     set task_count_this_month = case
           when current_period_start < this_period then 0 else task_count_this_month
         end,
         agent_executions_this_month = case
           when current_period_start < this_period then 0 else agent_executions_this_month
         end,
         current_period_start = case
           when current_period_start < this_period then this_period else current_period_start
         end
   where id = p_user_id;

  -- Increment the right counter.
  if p_event_type = 'task_create' then
    update profiles
       set task_count_this_month = coalesce(task_count_this_month, 0) + p_quantity
     where id = p_user_id;
  elsif p_event_type = 'agent_execute' then
    update profiles
       set agent_executions_this_month = coalesce(agent_executions_this_month, 0) + p_quantity
     where id = p_user_id;
  end if;

  -- Append audit record.
  insert into usage_events (user_id, event_type, quantity)
    values (p_user_id, p_event_type, p_quantity);

  return query
    select p.task_count_this_month, p.agent_executions_this_month, p.current_period_start
      from profiles p where p.id = p_user_id;
end;
$$;

-- 6) Rate limit check (sliding window). Returns remaining budget.
create or replace function consume_rate_limit(
  p_user_id uuid,
  p_bucket text,
  p_limit int,
  p_window_seconds int
) returns table (allowed boolean, remaining int, reset_at timestamptz)
language plpgsql security definer as $$
declare
  v_count int;
  v_window_start timestamptz;
  v_now timestamptz := now();
begin
  insert into rate_limits (user_id, bucket, count, window_start)
    values (p_user_id, p_bucket, 0, v_now)
    on conflict (user_id, bucket) do nothing;

  select count, window_start into v_count, v_window_start
    from rate_limits
   where user_id = p_user_id and bucket = p_bucket
   for update;

  if v_window_start + (p_window_seconds || ' seconds')::interval < v_now then
    update rate_limits
       set count = 1, window_start = v_now
     where user_id = p_user_id and bucket = p_bucket
    returning count, window_start into v_count, v_window_start;
    return query select true, p_limit - 1, v_window_start + (p_window_seconds || ' seconds')::interval;
    return;
  end if;

  if v_count >= p_limit then
    return query select false, 0, v_window_start + (p_window_seconds || ' seconds')::interval;
    return;
  end if;

  update rate_limits
     set count = count + 1
   where user_id = p_user_id and bucket = p_bucket
  returning count into v_count;

  return query select true, p_limit - v_count, v_window_start + (p_window_seconds || ' seconds')::interval;
end;
$$;

-- 7) Performance indexes for the most common task queries.
create index if not exists tasks_user_status_idx on tasks(user_id, status);
create index if not exists tasks_user_due_date_idx on tasks(user_id, due_date) where status not in ('done', 'cancelled');
