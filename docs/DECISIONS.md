# Decisions

## 2026-05-17 - Browser task writes are column-limited
### Decision
Direct authenticated browser Supabase inserts and updates on `tasks` are limited to user-editable task columns. Server-managed fields such as `agent_output`, `source_agent_id`, `external_ref`, `ingestion_intent`, `agent_metadata`, and `completed_at` are written by API routes, MCP handlers, import routes, or service-role jobs after auth and quota checks.

### Why
RLS ownership alone does not stop a signed-in user from spoofing agent output, trace metadata, completion timestamps, or imported external identifiers through the browser Supabase client. Nexdo's agent-readiness story depends on those fields carrying server-verified meaning.

### Impact
Authenticated task imports now save through the service-role path after auth/quota checks so imported completion timestamps and external source references still persist. Real Supabase smoke must verify direct browser denial, agent external-ref uniqueness, audit-event privacy, and normal task CRUD before launch readiness is claimed.

## 2026-05-17 - OpenAI smoke must cover every bounded execution type
### Decision
`npm run smoke:openai` should reject obvious placeholder keys and verify JSON-mode output for parsing, prioritization, briefing, and each supported bounded execution type: research, draft, and prep.
When run with `--app`, it should also create disposable Supabase data and verify the authenticated app parse, prioritize, briefing, and research/draft/prep execution routes.

### Why
Nexdo's MVP promise includes bounded execution across three action types. Verifying only a prep-shaped response leaves research and draft provider behavior weakly covered.

### Impact
Future execution action types should not be added to the product promise until the OpenAI smoke and response validators cover their provider output shape.

## 2026-05-17 - Stripe launch smoke must include signed webhook replay
### Decision
`npm run smoke:stripe -- --write --webhook` should create disposable Stripe and Supabase test data, post signed subscription webhook events to the configured app URL, verify unknown prices do not grant paid access, verify active subscriptions grant the expected paid tier, verify free/pro/power quota plan-state boundaries, exercise authenticated `POST /api/tasks` quota behavior under those tiers, verify deletes return the profile to Free, and verify duplicate event replay is idempotent.

### Why
Checkout and portal session creation do not prove the billing entitlement loop works. Early-access billing needs evidence that the deployed webhook can authenticate events, update Nexdo profile tiers, keep quotas aligned with those tiers, fail closed on unknown prices, and tolerate Stripe retries.

### Impact
Before production billing is treated as launch-ready, run the webhook smoke against the real preview/production target with Stripe test-mode env and the matching Supabase service-role env.

## 2026-05-17 - Agent write smokes must exercise the full task tool path
### Decision
`npm run smoke:mcp` should call the authenticated MCP initialized notification, SSE discovery endpoint, actual MCP JSON-RPC and ChatGPT Actions read surfaces, and its write mode should create, replay, read, update, complete, and optionally audit a disposable task. MCP `complete_task` accepts optional source-agent metadata so completion events can be traced like create and update events.
When run with `--provision`, it should create disposable Power-plan profiles with full-access and read-only scoped API keys so external-agent verification does not depend on manual key generation.

### Why
Listing tools is not enough evidence that an external agent can use Nexdo as a task layer. Launch verification needs to prove the advertised tools execute against real task data and that agent writes leave useful audit context.

### Impact
Future MCP tools should be added to the smoke script and audit expectations when they become part of the launch contract.

## 2026-05-17 - Agent task updates cover planning metadata
### Decision
MCP and ChatGPT Actions `update_task` should let external agents update the same core planning metadata humans can edit: due time, action type, estimated minutes, energy level, people, and tags, while still preserving bounded validation and server-managed trace fields.

### Why
Nexdo's agent promise depends on tasks being a useful structured work layer, not only a title/status checklist. Agents need to maintain planning metadata without bypassing ownership, scopes, audit logging, or field limits.

### Impact
Future task fields should be exposed through MCP/OpenAPI deliberately and added to local handler coverage plus `npm run smoke:mcp -- --write` before they become part of the agent contract.

## 2026-05-17 - Human task routes share validation
### Decision
Human task creation and patch routes use `lib/task-validation.ts` for normalization, allowlisting, and protected-field rejection.

### Why
Task data is the core product object and the future agent interop boundary. Validation embedded separately in routes was harder for future agents to inspect and could drift between create and update behavior.

### Impact
Future task fields should be added to the shared validation helper first, then exposed through UI/API routes deliberately. Server-managed fields such as agent outputs, ownership, source-agent metadata, and completion timestamps should stay out of generic human task mutations unless a dedicated route owns that behavior.

## 2026-05-17 - Parsed task due times are core task metadata
### Decision
Parsed tasks should include a nullable `due_time` field, and task capture should preserve it through demo tasks, authenticated task creation, MCP-created tasks, validation, and provider smoke expectations.

### Why
Due time is now part of the editable MVP task structure. If capture discards times mentioned in natural language, the core promise of turning messy input into structured task context is weaker than the UI suggests.

### Impact
Future parser, import, or agent-create changes should keep due date and due time together through validation, persistence, response formatting, and smoke coverage.

## 2026-05-17 - Planning should preserve due-time context
### Decision
Prioritization and briefing inputs should include `due_time`, and deterministic prioritization should order same-day timed tasks by due time before falling back to broader priority, date, people, and effort signals.

### Why
Capturing due time is only useful if the planning layer can use it. A timed morning task should not rank behind a later same-priority task just because both share the same due date.

### Impact
Future planning or briefing changes should keep due date and due time paired in provider summaries, local heuristics, and regression coverage.

## 2026-05-16 - Define the MVP as capture to bounded execution
### Decision
Nexdo's first launchable MVP is the concrete path documented in `docs/MVP.md`: capture plain-language tasks, structure them into useful metadata, prioritize the day, brief the user, execute bounded research/draft/prep work, and expose scoped task-layer access for external agents.

### Why
The product needs a launch contract that is narrower than broad "AI-native task manager" positioning and stricter than a demo-only checklist app. This path can be built, tested, sold honestly, and expanded without promising unbounded autonomy.

### Impact
Future product work should strengthen this path before broadening scope. New claims, controls, or integrations should map to the MVP acceptance gates or be marked post-MVP until verified.

## 2026-05-16 - API-key access is paid-plan gated
### Decision
API-key generation requires a Power or Team profile before rate-limit consumption, and MCP/API-key validation rejects keys for profiles outside the API-access tiers. The settings UI disables key generation when the current profile cannot use API access.

### Why
The product and pricing surfaces say API access belongs to the Power tier and above. Letting free or Pro profiles generate and use API keys would make billing truth, agent access, and quota expectations diverge.

### Impact
Real MCP smoke tests must use a Power or Team test profile. Future plan changes should update `canUseApiAccess` and rerun API-key/MCP smoke coverage.

## 2026-05-16 - Demo file imports stay client-side
### Decision
Logged-out visitors can import CSV, JSON, and ICS files in demo mode through client-side parsing and local task-store updates. Authenticated import APIs remain protected and continue to enforce auth, task quotas, and server-side persistence.

### Why
The import page should be usable in the no-env demo, but weakening server import routes would reintroduce unauthenticated body/file parsing and quota bypass risk.

### Impact
Future demo-only experiences can use client-side local state, but real account imports should continue through authenticated API routes and provider smoke tests.

## 2026-05-16 - OpenAI responses must be validated before use
### Decision
Runtime OpenAI helpers validate and bound JSON output before returning parsed tasks, prioritization, briefings, or research/draft/prep agent results. Malformed, missing, or incomplete provider output falls back to deterministic local task intelligence.

### Why
Provider JSON mode does not make the response a trusted application object. Nexdo should not return oversized strings, unknown enum values, task IDs that do not belong to the current request, or malformed agent output to users or persisted task records.

### Impact
Future AI helpers should add explicit response validators before model output crosses a route, UI, database, or agent boundary. Provider smoke still needs real OpenAI credentials because local fallbacks only prove graceful degradation.

## 2026-05-16 - AI task arrays are sanitized before provider calls
### Decision
Authenticated prioritization and briefing routes sanitize client-supplied task arrays into bounded task summaries before rate-limit consumption and OpenAI/fallback execution.

### Why
Briefing and prioritization are provider-backed surfaces. Oversized or malformed task payloads should fail or be trimmed before they can drive prompt size, spend, or brittle task-intelligence behavior.

### Impact
Future AI routes that accept client task payloads should share this pattern or load owned task records server-side.

## 2026-05-16 - Task creation payloads are normalized before quota
### Decision
Authenticated `POST /api/tasks` validates and normalizes title, raw input, description, due date/time, context, source, action type, estimates, energy, people, and tags before consuming task quota or inserting a task.

### Why
Task data powers briefing, prioritization, imports, and agent execution. Malformed arrays or oversized text should fail with clear 400s before quota is consumed or database errors leak through.

### Impact
Future task fields should be added to the explicit validation/normalization path before becoming client-writable.

## 2026-05-16 - MCP task creation respects task quota
### Decision
The `create_task` MCP/ChatGPT Actions tool validates bounded string/metadata inputs, replays idempotent `source_agent_id` plus `external_ref` requests before quota work, pre-checks `task_create` quota before parsing, inserts the new task, then records quota usage. If usage accounting fails after insert, the inserted task is deleted before returning an error.

### Why
External agents should use the same task-creation budget and validation rails as human-created tasks and imports. Agent interop cannot be a quota bypass.
Failed inserts should not spend quota, and failed accounting should not leave unmetered tasks behind.

### Impact
Real MCP write smoke should be run against a profile with available task quota. Future agent write tools should keep validation, ownership, scope, audit, idempotency, and quota behavior aligned.

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
Scoped API-key rotation goes through the shared user rate-limit rail before a new key is issued. The one-time key is returned only after the server writes the hashed key, key hint, scopes, and last-used reset to the user's profile.

### Why
API keys are the trust boundary for MCP and ChatGPT Actions. Rotation should remain easy for users but bounded enough to reduce accidental or automated abuse.
Returning an unstored key would leave users with a credential that cannot authenticate and would make external agent setup fail in a confusing way.

### Impact
Real Supabase smoke verification should include `consume_rate_limit` behavior for API-key rotation.

## 2026-05-16 - Imports must respect task quotas
### Decision
Authenticated imports pre-check task-create quota for the requested import size, save the tasks, then consume quota for the number of rows actually inserted. If quota accounting fails after save, inserted rows are deleted by returned task ID before returning an error.

### Why
Imports are task creation. Free-tier limits and future plan limits should not be bypassable through CSV, calendar, JSON, or external task imports.
Failed import saves should not spend quota, and quota-accounting failures should not leave unmetered imported tasks behind.

### Impact
Future import UX should show remaining task capacity before upload and real Supabase smoke tests should verify behavior near monthly limits.

## 2026-05-16 - Keep agent outputs reviewable, not just overwritten
### Decision
Store bounded research/draft/prep results as a versioned `agent_output` envelope with the current result, execution history, and a user review status/note.

### Why
Early AI execution should build trust through review and traceability. Replacing the prior output on every run made it harder to know what changed, whether the result had been checked, or whether another pass was needed.

### Impact
Future agent execution work should preserve the envelope contract or migrate it deliberately. Real Supabase smoke still needs to verify authenticated review-note persistence against a deployed task record.

## 2026-05-16 - Agent execution must operate on owned task records
### Decision
Authenticated `/api/agent/execute` requests must provide a task ID. The server loads the task for the current user, verifies it is executable, runs the bounded agent action, records quota usage, then saves the result to `agent_output`.

### Why
Agent execution is a core trust boundary. It should not execute arbitrary client-supplied task objects, silently ignore quota recording failures, or expose saved output without usage accounting.

### Impact
Future agent execution features should keep the owned-record boundary and add real Supabase/OpenAI smoke coverage before production use.

## 2026-05-16 - Keep billing entitlements tied to server-known prices
### Decision
Checkout requests may choose only the `pro` or `power` plan key, and the server derives the Stripe price ID from environment configuration. Checkout must fail if the Stripe customer ID cannot be persisted to the user's profile. Stripe webhooks must ignore unknown, missing, or placeholder price IDs instead of defaulting to a paid Nexdo tier, and entitlement profile writes must fail for Stripe retry on database errors or unmatched customer profiles.

### Why
Paid access should not depend on client-supplied price IDs or implicit fallback mappings. Launch billing needs predictable, auditable plan selection before pricing is externally committed.
The webhook customer lookup depends on the stored `stripe_customer_id`; silently ignoring persistence failures can strand paid users without an entitlement update.

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
