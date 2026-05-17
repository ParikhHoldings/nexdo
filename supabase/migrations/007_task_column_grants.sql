-- Keep agent-owned task metadata and output server-managed for browser clients.
--
-- RLS already limits rows to the owning user, but broad table-level insert/update
-- grants still let authenticated browser clients write columns that should be
-- owned by API routes, MCP handlers, and service-role jobs.

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
  source,
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
  source,
  action_type,
  estimated_minutes,
  energy_level,
  people,
  tags,
  parent_task_id,
  related_task_ids
) on table tasks to authenticated;
