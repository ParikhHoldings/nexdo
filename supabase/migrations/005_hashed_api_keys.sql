-- Store external API keys as one-way hashes and narrow direct profile updates.

alter table profiles
  add column if not exists api_key_hash text,
  add column if not exists api_key_hint text;

create unique index if not exists profiles_api_key_hash_unique_idx
  on profiles(api_key_hash)
  where api_key_hash is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_api_key_hash_sha256'
  ) then
    alter table profiles
      add constraint profiles_api_key_hash_sha256
      check (api_key_hash is null or api_key_hash ~ '^[a-f0-9]{64}$');
  end if;
end $$;

update profiles
set
  api_key_hash = encode(digest(api_key, 'sha256'), 'hex'),
  api_key_hint = left(api_key, 8) || '...' || right(api_key, 4),
  api_key = null,
  updated_at = now()
where api_key is not null
  and api_key_hash is null;

update profiles
set
  api_key = null,
  updated_at = now()
where api_key is not null
  and api_key_hash is not null;

-- Profile edits from browser sessions are limited to user-owned preference
-- fields. Credential, billing, quota, and entitlement changes must go through
-- server routes or service-role jobs.
revoke update on table profiles from anon;
revoke update on table profiles from authenticated;
grant update (full_name, timezone, work_type) on table profiles to authenticated;
