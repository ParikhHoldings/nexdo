-- Enforce profile settings bounds at the database layer.
--
-- Direct authenticated browser updates are limited to profile preference
-- columns, but those columns still need the same bounds as the profile route
-- so clients cannot bypass the app contract with blank names, oversized names,
-- or unsupported timezone values.

alter table profiles
  drop constraint if exists profiles_full_name_length,
  drop constraint if exists profiles_timezone_allowed;

alter table profiles
  add constraint profiles_full_name_length
    check (full_name is null or char_length(btrim(full_name)) between 1 and 120)
    not valid,
  add constraint profiles_timezone_allowed
    check (
      timezone in (
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'UTC'
      )
    )
    not valid;
