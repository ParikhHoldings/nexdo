# MVP Path

Date: 2026-05-16

## MVP promise
Nexdo's first trustworthy MVP is not "AI does everything." It is a task workspace that turns messy task capture into structured, prioritized, reviewable work that humans can act on today and AI agents can safely interact with tomorrow.

The launchable path is:
1. Capture plain-language tasks.
2. Structure the task into useful metadata.
3. Prioritize the day with explainable reasons.
4. Brief the user on what matters.
5. Execute bounded research, draft, and prep work for owned tasks.
6. Let external agents read and write tasks through scoped, audited API access.

## Human-user MVP

### 1. Capture
Users can add a plain-language task from the main workspace.

Acceptance gate:
- `/today` and `/all` expose task capture.
- Captured tasks appear immediately in the workspace.
- Logged-out demo captures persist across reloads.
- Authenticated captures must save through `POST /api/tasks` with validation and task quota checks.
- Failed authenticated captures must not create local-only tasks that disappear on reload.

Current evidence:
- `TaskInput` supports capture.
- `npm run test:e2e` covers logged-out task creation and reload persistence.
- `POST /api/tasks` validates normalized task input before quota and insert.
- Authenticated task-capture save failures restore the input and show an error instead of adding a local demo task.

### 2. Structure
Tasks should carry enough context to support prioritization, briefing, execution, and agent interop.

Required fields:
- title
- status
- priority
- due date and optional due time
- context or description
- action type
- estimated minutes
- energy level
- people
- tags
- source metadata for agent-created tasks when relevant

Acceptance gate:
- Users can inspect and edit core task fields.
- Failed authenticated edits/deletes do not leave stale optimistic UI without warning.
- AI/provider output is validated before becoming task data.
- Generic user edits cannot spoof server-managed agent output.

Current evidence:
- `TaskDetail` edit mode supports the MVP task fields.
- The task store rolls back failed authenticated edit/delete mutations and surfaces visible app notifications.
- `lib/ai-response-validation.ts` bounds OpenAI output.
- `PATCH /api/tasks/[id]` allowlists user-editable fields and rejects `agent_output`.

### 3. Prioritize
The product should make the daily list more useful than a static checklist.

Acceptance gate:
- `/today` orders incomplete tasks with visible reasoning.
- Missing provider credentials still produce deterministic demo prioritization.
- Authenticated prioritization validates task payloads before rate-limit/provider work.

Current evidence:
- `/today` uses AI/provider prioritization for authenticated users and deterministic fallback for demo users.
- Playwright verifies visible "Why now" reasoning.
- `lib/ai-task-input.ts` sanitizes task arrays before provider calls.

### 4. Brief
The daily briefing should summarize urgent work, quick wins, overdue work, and people waiting.

Acceptance gate:
- The briefing is visible in the main daily workspace.
- It refreshes from current task state after capture/import in demo mode.
- Authenticated briefing requests validate inputs before rate-limit/provider work.

Current evidence:
- `DailyBriefing` renders on `/today`.
- Playwright verifies the active-task count updates after adding a task.
- `/api/briefing` uses sanitized task input.

### 5. Execute bounded work
Execution must stay narrow and reviewable.

Supported MVP action types:
- `research`
- `draft`
- `prep`

Non-goal for MVP:
- open-ended autonomous task completion
- unreviewed external side effects
- arbitrary browser, email, billing, or customer communication actions

Acceptance gate:
- The UI exposes execution only for supported task types.
- The server loads an owned task by ID before executing.
- Agent output is saved only after quota/rate checks succeed.
- Output remains reviewable by the user.

Current evidence:
- `/api/agent/execute` requires `taskId`, loads owned task records, rejects unsupported action types, and saves output server-side.
- Playwright verifies demo draft execution produces reviewable output.

## AI-agent MVP

### 1. Task-layer API
External agents should be able to use Nexdo as a structured task layer without bypassing user trust rails.

Required tool surface:
- list tasks
- create task
- complete task
- update task
- get briefing
- search tasks
- get task

Acceptance gate:
- OpenAPI and MCP surfaces advertise the same core task contract.
- Bearer auth is required before action execution.
- Scope-limited keys hide and deny unauthorized tools.
- Write tools validate bounded inputs and consume quotas where appropriate.
- Search behavior matches the advertised task contract, including title, context, and tags.

Current evidence:
- `/api/mcp/openapi` exposes the ChatGPT Actions schema.
- `/api/mcp/actions/[tool]` enforces bearer auth and scopes.
- `search_tasks` filters title, context, and tags in the MCP handler.
- `npm run test:e2e` covers OpenAPI, action auth, CORS, and unsupported billing guardrails.
- `npm run smoke:mcp` exists for real API-key read/write/idempotency checks once a real environment is configured.

### 2. Agent traceability
Agent-created work must be distinguishable from human-created work.

Required fields:
- `source_agent_id`
- `external_ref`
- `ingestion_intent`
- `agent_metadata`

Acceptance gate:
- Agent writes can include source metadata.
- Idempotency replay works through `source_agent_id` plus `external_ref`.
- Agent calls write audit events in real Supabase verification.

Current evidence:
- MCP create/update schemas expose agent metadata fields.
- The idempotency migration and handler logic exist.
- Real Supabase/MCP smoke is still required before claiming production readiness.

### 3. Least privilege and audit
Agent access should default to scoped, observable permissions.

Acceptance gate:
- API access is gated to Power/team profiles.
- API keys are scoped and hashed.
- The settings UI shows key scopes and recent agent activity.
- Real provider smoke verifies scope denial and audit writes.

Current evidence:
- API-key generation and validation are Power/team gated.
- Hashed key storage and key hints exist.
- `/settings/mcp` includes scope-aware setup and activity surfaces.
- Real Supabase/API-key smoke remains a launch blocker.

## Monday early-access success criteria
Monday is credible if:
- local install, lint, typecheck, build, audit, and Playwright rails are green
- the logged-out demo proves the human workflow end to end
- the API/agent surfaces have schema/auth/scope guardrails in place
- production/provider gaps are explicitly documented as blockers
- public copy stays below verified truth

Monday is not credible if:
- provider-backed auth, database, AI, billing, or MCP flows are implied as verified without real smokes
- pricing or external API commitments are made before approval
- the product is described as autonomous beyond bounded research/draft/prep output

## Launch blockers
- Real Supabase migrations, auth, RLS, task CRUD, quota, and audit smoke.
- Real OpenAI parse, prioritize, briefing, and execution smoke.
- Stripe test-mode checkout, portal, webhook, entitlement, quota, and idempotency smoke.
- Real MCP/API-key execution, read-only denial, idempotency replay, and audit-write smoke.
- Quill/founder approval for public copy.
- Approval for any production deploy or public launch commitment.

## Next product hardening after MVP
- Add focused route/helper tests for task validation, import normalization, quota/rate-limit helpers, and MCP handlers.
- Add import previews and remaining-quota warnings before authenticated imports.
- Add execution history and verification notes for agent outputs.
- Add notification delivery only after real notification behavior exists.
- Add theme controls only after real theme support exists.
