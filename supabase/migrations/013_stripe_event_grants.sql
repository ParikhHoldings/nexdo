-- Keep Stripe webhook idempotency records service-owned.
--
-- Stripe event ids determine whether a webhook has already been processed.
-- Browser clients should never be able to read, create, or mutate those
-- records because doing so could leak billing event ids or spoof duplicate
-- processing state.

alter table stripe_events enable row level security;

revoke all on table stripe_events from anon;
revoke all on table stripe_events from authenticated;
