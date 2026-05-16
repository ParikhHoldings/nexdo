# Decisions

## 2026-05-16 - Agent output is server-managed
### Decision
Generic task PATCH requests cannot write `agent_output`. Agent output must be produced and persisted through `/api/agent/execute`, which loads an owned task, checks action type, gates rate/quota, and records output server-side.

### Why
Agent output is evidence that a bounded agent action ran. Allowing clients to mutate it through the generic task route would weaken trust in task history and agent-readiness surfaces.

### Impact
Client UI can still update local state with returned output for responsiveness, but persisted agent output must come from the dedicated execution route.

## 2026-05-16 - Store external API keys as hashes
### Decision
New Nexdo MCP/API keys are stored as SHA-256 hashes with a short display hint. The raw key is returned only at generation time, and migration `005_hashed_api_keys.sql` hashes existing raw keys before clearing them.

### Why
API keys are the external-agent trust boundary. They should not be copied into browser profile state or remain readable in the database after generation.

### Impact
Users must copy new keys when generated. Existing keys continue to validate through their hash, and the MCP settings page uses key hints plus an explicit paste field for connection tests.

## 2026-05-16 - Profile browser access is column-limited
### Decision
Direct authenticated profile reads expose only the fields the app needs for account preferences, plan display, key hints, and usage display. Direct authenticated profile updates are limited to `full_name`, `timezone`, and `work_type`. Credential, billing, quota, Stripe, and entitlement fields must be changed by server routes, provider webhooks, or service-role jobs.

### Why
RLS ownership alone does not prevent a signed-in user from reading or updating sensitive columns on their own profile through the Supabase client. Billing and agent trust state need a server-side boundary.

### Impact
Profile preference updates still work through `PATCH /api/profile`; API-key rotation and Stripe customer persistence use service-role server routes. Real Supabase smoke must verify allowed profile reads/edits and denied sensitive-column reads/edits.

## 2026-05-16 - Profile updates must be allowlisted
### Decision
`PATCH /api/profile` validates mutable profile fields before updating: bounded name length, known timezone values, and known work types.

### Why
Settings data flows into personalization and product surfaces. Invalid profile data should fail with clear 400s instead of relying on database errors or accepting arbitrary strings.

### Impact
Future profile fields should add explicit API validation before being written.

## 2026-05-16 - Validate AI request bodies before consuming rate limits
### Decision
Task parse, prioritization, and briefing routes parse and validate request bodies before calling the shared rate-limit RPC.

### Why
Malformed requests should receive fast 400 responses without consuming a user's AI request window or touching provider-adjacent rails.

### Impact
Future AI routes should follow the same order: auth, body validation, rate-limit check, provider work.

## 2026-05-16 - Keep OpenAI model selection consistent
### Decision
App OpenAI helpers use `OPENAI_MODEL` when provided and default to `gpt-4o`, matching the OpenAI smoke script.

### Why
Provider smoke should verify the same model contract used by runtime AI helpers. Placeholder API keys should trigger local fallback behavior rather than failed provider calls.

### Impact
Future model changes can happen through environment configuration and should be verified with `npm run smoke:openai`.

## 2026-05-16 - MCP smoke must verify least-privilege keys
### Decision
`npm run smoke:mcp` supports an optional read-only API key to verify scoped keys hide write tools and reject write calls.

### Why
Agent readiness depends on least-privilege behavior, not just full-access happy paths.

### Impact
Real MCP verification should include both a normal key and a read-only scoped key before external agent use.

## 2026-05-16 - Quota read probes must not write audit noise
### Decision
`increment_usage` keeps its quantity-0 reset/read behavior, but skips counter increments and `usage_events` writes when quantity is zero.

### Why
The API uses quantity 0 to lazily reset/read usage counters. Those probes should not pollute the usage audit log or confuse later quota investigation.

### Impact
Supabase write smoke now verifies no-op quota behavior plus task/agent quota increments and rate-limit allow/block behavior.

## 2026-05-16 - Do not show unconfigured annual billing
### Decision
The pricing table shows only monthly prices until annual Stripe price IDs and checkout handling exist.

### Why
The UI previously displayed an annual toggle and 20% savings, but checkout only selected a single server price for each paid plan.

### Impact
Annual pricing can be added later with explicit annual price IDs, checkout plan interval handling, and Stripe test-mode verification.

## 2026-05-16 - API key rotation uses rate limits
### Decision
Scoped API-key rotation goes through the shared user rate-limit rail before a new key is issued.

### Why
API keys are the trust boundary for MCP and ChatGPT Actions. Rotation should remain easy for users but bounded enough to reduce accidental or automated abuse.

### Impact
Real Supabase smoke verification should include `consume_rate_limit` behavior for API-key rotation.

## 2026-05-16 - Imports must respect task quotas
### Decision
Authenticated imports consume task-create quota for the number of tasks being imported before saving them.

### Why
Imports are task creation. Free-tier limits and future plan limits should not be bypassable through CSV, calendar, JSON, or external task imports.

### Impact
Future import UX should show remaining task capacity before upload and real Supabase smoke tests should verify behavior near monthly limits.

## 2026-05-16 - Agent execution must operate on owned task records
### Decision
Authenticated `/api/agent/execute` requests must provide a task ID. The server loads the task for the current user, verifies it is executable, runs the bounded agent action, records quota usage, then saves the result to `agent_output`.

### Why
Agent execution is a core trust boundary. It should not execute arbitrary client-supplied task objects, silently ignore quota recording failures, or expose saved output without usage accounting.

### Impact
Future agent execution features should keep the owned-record boundary and add real Supabase/OpenAI smoke coverage before production use.

## 2026-05-16 - Keep billing entitlements tied to server-known prices
### Decision
Checkout requests may choose only the `pro` or `power` plan key, and the server derives the Stripe price ID from environment configuration. Stripe webhooks must ignore unknown price IDs instead of defaulting to a paid Nexdo tier.

### Why
Paid access should not depend on client-supplied price IDs or implicit fallback mappings. Launch billing needs predictable, auditable plan selection before pricing is externally committed.

### Impact
Future billing changes must update the server-side price mapping and rerun Stripe test-mode checkout, portal, webhook, and quota smoke checks before public use.

## 2026-05-16 - Treat Monday as verified early access, not broad launch
### Decision
Aim for a verified early-access/demo-ready product by Monday, 2026-05-18, with truthful copy, passing rails, and a clear launch-blocker list.

### Why
The app has enough product surface to demonstrate the core workflow, but production env, billing, security, and agent integrations still need end-to-end verification.

### Impact
Future agents should prioritize checks, demo reliability, and blocker removal before broad marketing or production commitments.

## 2026-05-16 - Keep demo intelligence useful without provider env
### Decision
Use deterministic local fallbacks for task parsing, prioritization, daily briefing, and bounded research/draft/prep outputs when OpenAI or Supabase is unavailable.

### Why
The logged-out demo and local development experience must show the real product shape even when provider credentials are not configured.

### Impact
The fallback path is not a replacement for provider-backed AI, but it keeps the core workflow inspectable and testable.

## 2026-05-16 - Ground agent context in the actual implementation
### Decision
Update agent-facing docs to describe Nexdo as an active Next.js/Supabase/OpenAI/Stripe product shell with task, AI, import, billing, and MCP surfaces, while marking deploy/build/env truth as still unverified.

### Why
The prior operating docs framed Nexdo mostly as a concept. The repo now contains enough concrete product code that future agents need an accurate map of what exists and what still needs verification.

### Impact
Agents should prioritize verification and hardening of the existing product surfaces over abstract repositioning. Product claims must be checked against the implementation before being treated as launch-ready.

## 2026-05-16 - Keep public promises below verified product truth
### Decision
Public copy must be audited against the real product and routed through Quill before external launch use.

### Why
The marketing page includes strong claims around AI task execution, integrations, security, and user traction. Those claims may be useful draft direction, but they should not ship as verified commitments without review.

### Impact
Marketing work can continue as draft work, but production launch copy needs approval and a product-truth check.

## 2026-04-11 - Add the autonomous operating layer to the live Nexdo repo
### Decision
Apply the canonical autonomous OS standard directly to the live Nexdo repo.

### Why
The operating system should live in the actual product repo, not only in a local control-layer folder.

### Impact
The repo now carries the canonical doc set and repo-level constitution for autonomous management.

## 2026-04-11 - Repo/deploy verification takes priority over vague product rhetoric
### Decision
The next important Nexdo step is verifying real build/deploy rails before drifting into more abstract positioning work.

### Why
The portfolio queue already marks repo/deploy verification as the next major milestone.

### Impact
Execution should prioritize reality, scaffolding, and MVP clarity over high-level productivity branding alone.
