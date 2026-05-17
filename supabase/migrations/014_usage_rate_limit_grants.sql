-- Keep quota telemetry and rate-limit buckets service-mutated.
--
-- Users may eventually read their own usage history, but quota counters and
-- rate-limit buckets are product control state. Browser clients must not be
-- able to create, edit, or delete usage events, or inspect/mutate rate-limit
-- buckets directly.

revoke insert, update, delete on table usage_events from anon;
revoke insert, update, delete on table usage_events from authenticated;

revoke all on table rate_limits from anon;
revoke all on table rate_limits from authenticated;
