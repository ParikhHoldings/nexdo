-- Keep sensitive profile columns out of browser-accessible Supabase reads.

revoke select on table profiles from anon;
revoke select on table profiles from authenticated;

grant select (
  id,
  full_name,
  timezone,
  work_type,
  subscription_tier,
  api_key_hint,
  api_key_scopes,
  api_key_last_used_at,
  task_count_this_month,
  agent_executions_this_month,
  created_at,
  updated_at
) on table profiles to authenticated;

revoke update on table profiles from anon;
revoke update on table profiles from authenticated;
grant update (full_name, timezone, work_type) on table profiles to authenticated;
