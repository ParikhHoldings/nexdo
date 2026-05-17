-- Keep cached daily briefing rows service-owned.
--
-- Users can read their own cached briefings if/when the product uses this
-- table, but browser clients should not be able to spoof provider-generated
-- briefing content or mutate cache rows directly.

revoke insert, update, delete on table daily_briefings from anon;
revoke insert, update, delete on table daily_briefings from authenticated;
