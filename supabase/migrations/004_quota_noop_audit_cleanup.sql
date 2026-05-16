-- Quota cleanup: lazy usage reads call increment_usage with quantity 0.
-- Keep that reset behavior, but do not write zero-quantity audit events.

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
  if p_quantity < 0 then
    raise exception 'p_quantity must be non-negative';
  end if;

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

  -- Quantity 0 is a read/reset probe. Return current counters without
  -- incrementing counters or writing audit noise.
  if p_quantity > 0 then
    if p_event_type = 'task_create' then
      update profiles
         set task_count_this_month = coalesce(task_count_this_month, 0) + p_quantity
       where id = p_user_id;
    elsif p_event_type = 'agent_execute' then
      update profiles
         set agent_executions_this_month = coalesce(agent_executions_this_month, 0) + p_quantity
       where id = p_user_id;
    end if;

    insert into usage_events (user_id, event_type, quantity)
      values (p_user_id, p_event_type, p_quantity);
  end if;

  return query
    select p.task_count_this_month, p.agent_executions_this_month, p.current_period_start
      from profiles p where p.id = p_user_id;
end;
$$;
