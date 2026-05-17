-- Keep task-note metadata server-managed for browser clients.
--
-- Users can create note content for their own tasks, but direct browser writes
-- should not spoof metadata such as note type or creation time.

alter table task_notes
  drop constraint if exists task_notes_content_length;

alter table task_notes
  add constraint task_notes_content_length
  check (char_length(btrim(content)) between 1 and 2000)
  not valid;

revoke insert on table task_notes from anon;
revoke insert on table task_notes from authenticated;
revoke update on table task_notes from anon;
revoke update on table task_notes from authenticated;

grant insert (
  task_id,
  content
) on table task_notes to authenticated;
