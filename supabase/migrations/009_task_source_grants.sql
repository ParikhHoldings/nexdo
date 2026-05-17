-- Keep the broad task source flag server-mediated.
--
-- Migration 007 narrowed browser task writes but still allowed direct clients
-- to set `source`. Because the UI treats `source = 'agent'` as an agent-trace
-- signal, browser clients should not write it directly. Human/API task
-- creation can still persist validated non-agent source values through
-- service-role routes after auth and quota checks.

revoke insert on table tasks from anon;
revoke insert on table tasks from authenticated;
revoke update on table tasks from anon;
revoke update on table tasks from authenticated;

grant insert (
  user_id,
  title,
  raw_input,
  description,
  status,
  priority,
  due_date,
  due_time,
  context,
  action_type,
  estimated_minutes,
  energy_level,
  people,
  tags,
  parent_task_id,
  related_task_ids
) on table tasks to authenticated;

grant update (
  title,
  raw_input,
  description,
  status,
  priority,
  due_date,
  due_time,
  context,
  action_type,
  estimated_minutes,
  energy_level,
  people,
  tags,
  parent_task_id,
  related_task_ids
) on table tasks to authenticated;
