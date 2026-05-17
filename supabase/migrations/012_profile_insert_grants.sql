-- Keep profile row creation server-owned.
--
-- Profiles carry entitlement, API-key, quota, and Stripe state. They are
-- normally created by the auth trigger and later mutated through dedicated
-- service-role routes. Direct browser inserts are not needed for launch and
-- could spoof paid/API state if a profile row is missing.

revoke insert on table profiles from anon;
revoke insert on table profiles from authenticated;
