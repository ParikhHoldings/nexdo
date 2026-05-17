-- Keep task-note metadata server-managed for browser clients.
--
-- Users can create note content for their own tasks, but direct browser writes
-- should not spoof metadata such as note type or creation time.

revoke insert on table task_notes from anon;
revoke insert on table task_notes from authenticated;
revoke update on table task_notes from anon;
revoke update on table task_notes from authenticated;

grant insert (
  task_id,
  content
) on table task_notes to authenticated;
