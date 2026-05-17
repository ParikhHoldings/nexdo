-- Keep task relationship metadata service-owned until owned linking exists.
--
-- Parent and related task ids need ownership-aware validation before they can
-- be browser-editable. The launch UI and API routes do not expose task
-- linking yet, so direct browser writes should not be able to attach arbitrary
-- UUID relationships.

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
  tags
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
  tags
) on table tasks to authenticated;
