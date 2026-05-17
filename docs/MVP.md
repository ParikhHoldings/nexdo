# MVP Path

Date: 2026-05-17

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
- Failed or stale-session authenticated captures must not create local-only tasks that disappear on reload.

Current evidence:
- `TaskInput` supports capture.
- Natural-language capture now carries parsed due times into demo tasks, authenticated task creation, and MCP-created tasks; local fallback parsing keeps scheduling, priority, relative-date connectors, and estimate phrases out of the title when those values can be structured separately.
- Task capture exposes a labeled `Add task` submit control in addition to Enter-key submission.
- `/quick` capture now trims extra spacing and refuses empty quick-mode submissions instead of creating a malformed task.
- `npm run test:e2e` covers logged-out task creation and reload persistence.
- `POST /api/tasks` uses `lib/task-validation.ts` to validate normalized task input and reject protected fields before quota and insert.
- Authenticated task-capture save failures or stale sessions restore the input and show an error instead of adding a local demo task.

### 2. Structure
Tasks should carry enough context to support prioritization, briefing, execution, and agent interop.

Required fields:
- title
- status
- priority
- due date and optional due time
- context or description
- task notes for decisions, links, and handoff context
- parent and related task links for mapping work dependencies and handoff context
- action type
- estimated minutes
- energy level
- people
- tags
- source metadata for agent-created tasks when relevant

Acceptance gate:
- Users can inspect and edit core task fields.
- Users can save bounded profile preferences that keep account personalization valid.
- Users can explicitly review and restore cancelled tasks so agent-side cancellation does not hide work from the human owner.
- Non-default task statuses are visible on task cards so human owners can spot work that is in progress, waiting, done, or cancelled.
- Users can move scanned tasks into started, waiting, to-do, or restored states without opening task detail.
- Users can filter All Tasks by agent-originated or human-created work for focused review.
- Users can filter All Tasks by unreviewed/needs-revision versus verified agent outputs.
- Users can link a task to an owned parent task or related tasks from task detail.
- Users can download a portable copy of currently loaded tasks for backup, review, or agent handoff.
- Users can restore a copied Nexdo task handoff into a new task with structured metadata and reviewable notes.
- Failed authenticated edits/deletes do not leave stale optimistic UI without warning.
- AI/provider output is validated before becoming task data.
- Generic user edits cannot spoof server-managed agent output.
- Direct browser Supabase writes cannot spoof server-managed agent output, the broad task source flag, source-agent metadata, ingestion intent, or completion timestamps.
- Direct browser Supabase writes cannot set task relationship metadata; owned task linking uses the route-level ownership-checked service path.
- Direct browser Supabase writes cannot bypass core task content bounds for blank titles, oversized text, impossible estimates, or unbounded people/tag arrays.
- Direct browser Supabase writes cannot spoof task-note metadata such as note type or creation time.
- Direct browser Supabase writes cannot bypass the bounded task-note content contract.

Current evidence:
- `TaskDetail` edit mode supports the MVP task fields, including optional due time and energy level.
- `TaskDetail` supports task notes and a copyable task handoff brief, with demo localStorage persistence and authenticated owned-task API routes.
- `/import` can parse a copied `# Nexdo Task Handoff` brief and restore the task metadata plus recent notes; source-agent trace fields are preserved as a reviewable note instead of browser-spoofing server-managed task fields.
- `TaskDetail` supports parent/related task links, with demo persistence and authenticated writes through `app/api/tasks/[id]/relationships/route.ts`.
- All Tasks defaults to active work but can filter into `done` and `cancelled`; task detail includes `cancelled` in the human status selector.
- All Tasks includes an Origin filter for isolating agent-traced tasks from human-created tasks.
- All Tasks includes an agent-output review filter for isolating unreviewed/needs-revision outputs from verified outputs.
- Task cards show agent-output review badges for unreviewed, needs-revision, and verified outputs.
- Sidebar navigation includes an Agent Review queue that deep-links to `/all?review=needs_review`.
- Task cards show status badges for `in_progress`, `waiting`, `done`, and `cancelled`.
- Task-card menus expose quick `Start`, `Mark waiting`, `Move to to-do`, and `Restore` actions, with the controls visible on mobile/touch viewports as well as desktop hover/focus.
- Settings > Data exports the tasks currently loaded in the workspace as JSON or CSV through `lib/task-export.ts`.
- `lib/task-handoff.ts` has focused parser coverage for round-trip metadata, duplicate fields, enum normalization, due-date/time ambiguity, and note bounds; Playwright verifies demo paste-import restores task context and notes.
- The task store rolls back failed authenticated edit/delete mutations and surfaces visible app notifications.
- `lib/ai-response-validation.ts` bounds OpenAI output.
- `PATCH /api/tasks/[id]` uses `lib/task-validation.ts` to allowlist user-editable fields and reject protected/server-managed fields such as `user_id`, `completed_at`, `source_agent_id`, and `agent_output`.
- Migrations `007_task_column_grants.sql`, `009_task_source_grants.sql`, `010_task_content_constraints.sql`, and `016_task_relationship_grants.sql` limit direct authenticated task inserts/updates to user-editable columns that exclude the broad task source flag, task relationship metadata, and other server-managed fields while still enforcing the core task content bounds; human task creation, task completion, agent output, trace metadata, task relationships, and imported completion/external refs are written through server/service-role paths.
- Migration `008_task_note_column_grants.sql` limits direct authenticated task-note inserts to `task_id` and `content`, while also enforcing non-empty note content up to 2,000 characters; authenticated note routes write server-managed note metadata through the service-role path after ownership checks.

### 3. Prioritize
The product should make the daily list more useful than a static checklist.

Acceptance gate:
- `/today` orders incomplete tasks with visible reasoning.
- Missing provider credentials still produce deterministic demo prioritization.
- Authenticated prioritization validates task payloads before rate-limit/provider work.

Current evidence:
- `/today` uses AI/provider prioritization for authenticated users and deterministic fallback for demo users.
- `/today`, the sidebar, daily briefing, provider briefing inputs, and browser reminders share the same active-task definition, including undated active tasks and excluding done/cancelled work.
- Prioritization summaries and deterministic fallback now include due times so timed same-day work can rank ahead of later timed work.
- Deterministic fallback behavior has focused regression coverage for parsing, prioritization, briefing, and bounded execution output shapes.
- AI task input validation and rate-limit response helper contracts have focused regression coverage.
- Playwright verifies visible "Why now" reasoning.
- `lib/ai-task-input.ts` sanitizes task arrays before provider calls.

### 4. Brief
The daily briefing should summarize urgent work, quick wins, overdue work, and people waiting.

Acceptance gate:
- The briefing is visible in the main daily workspace.
- It refreshes from current task state after capture/import/edit changes.
- Authenticated briefing requests validate inputs before rate-limit/provider work.
- Past due times today are treated as overdue in the local briefing, not only dates before today.

Current evidence:
- `DailyBriefing` renders on `/today`.
- Playwright verifies the active-task count updates after adding a task.
- Authenticated briefing requests refetch when the planning-relevant task-state signature or user name changes.
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
- Output remains reviewable by the user with run history and verification notes.

Current evidence:
- `/api/agent/execute` requires `taskId`, loads owned task records, rejects unsupported action types, and saves output server-side.
- `lib/task-actions.ts` is the shared executable-action contract for task cards, task detail, authenticated execution, and agent-output history.
- Playwright verifies demo draft execution produces reviewable output, verification notes, and execution history.
- Playwright verifies `remind` tasks do not expose AI-agent run controls.

## AI-agent MVP

### 1. Task-layer API
External agents should be able to use Nexdo as a structured task layer without bypassing user trust rails.

Required tool surface:
- list tasks
- create task
- complete task
- update task
- add task note
- get briefing
- search tasks
- get task

Acceptance gate:
- OpenAPI and MCP surfaces advertise the same core task contract.
- OpenAPI and MCP status enums must stay aligned with handler validation, including `cancelled`.
- OpenAPI and MCP nullability must stay aligned with handler behavior, including nullable due-date/context clears on `update_task`.
- ChatGPT Actions responses match advertised task, briefing, and error shapes.
- Bearer auth is required before action execution.
- Scope-limited keys hide and deny unauthorized tools.
- Write tools validate bounded inputs and consume quotas where appropriate.
- Search behavior matches the advertised task contract, including title, context, description, people, and tags.

Current evidence:
- `/api/mcp/openapi` exposes the ChatGPT Actions schema.
- `/api/mcp/actions/[tool]` enforces bearer auth and scopes.
- `/api/mcp/actions/[tool]` uses a shared formatter for action responses.
- MCP JSON-RPC rejects malformed non-object request bodies before field access; `tools/call` and ChatGPT Action wrappers reject non-object tool argument payloads before execution, and shared Bearer parsing handles standard case-insensitive auth schemes with harmless extra spacing.
- `search_tasks` and All Tasks search use the shared metadata search helper across title, context, description, people, and tags.
- `update_task` accepts the same core planning fields humans can edit: status, due time, action type, estimate, energy level, people, tags, and owned parent/related task links.
- `update_task` requires `source_agent_id` when `external_ref` is supplied, matching create, complete, and note traceability rules.
- `add_task_note` lets external agents append bounded, human-reviewable notes or `agent_result` notes to owned tasks without changing task status, and `get_task` returns recent task notes.
- `npm run test:e2e` covers OpenAPI, action auth, CORS, and unsupported billing guardrails.
- `npm run smoke:mcp` exists for real API-key initialized-notification handshake, SSE endpoint discovery, malformed JSON-RPC/action payload guard checks, list/search/briefing/get/structured-update/relationship-update/add-note/complete/idempotency checks, ChatGPT Actions list/search/add-note response-shape checks, optional read-only scope denial, provisioned disposable scoped keys, completed-task trace persistence, and required `agent_action_events` audit verification with `--provision --write --audit` once a real environment is configured.

### 2. Agent traceability
Agent-created work must be distinguishable from human-created work.

Required fields:
- `source_agent_id`
- `external_ref`
- `ingestion_intent`
- `agent_metadata`

Acceptance gate:
- Agent writes can include source metadata.
- Agent writes that include `external_ref` must include `source_agent_id`.
- Agent tool execution creates an `agent_action_events` row before handler mutation, so unavailable audit logging blocks task mutation.
- Idempotency replay works through `source_agent_id` plus `external_ref`.
- Agent calls write audit events in real Supabase verification.

Current evidence:
- MCP create/update/add-note/complete schemas expose agent metadata fields.
- MCP execution preflights `agent_action_events` and local handler coverage verifies unaudited updates fail before mutating a task.
- Task cards and task detail show agent-origin trace metadata for agent-created, agent-updated, or agent-completed tasks.
- The idempotency migration and handler logic exist.
- `npm run smoke:supabase -- --write` can verify the unique database index rejects duplicate `source_agent_id` plus `external_ref` task rows.
- `npm run smoke:app` can verify authenticated app-cookie task CRUD, task-note validation/create/readback, and agent-review validation/save behavior against a real Supabase-backed app session.
- `npm run smoke:mcp -- --provision --write --audit` can verify real `create_task`, `update_task`, `add_task_note`, and `complete_task` audit rows with `source_agent_id` plus `external_ref`, and `complete_task` task-row trace persistence, when Supabase service-role env is loaded.
- Real Supabase/MCP smoke is still required before claiming production readiness.

### 3. Least privilege and audit
Agent access should default to scoped, observable permissions.

Acceptance gate:
- API access is gated to Power/team profiles.
- API keys are scoped and hashed.
- The settings UI shows key scopes and recent agent activity.
- Agent activity reads are scoped to the authenticated user.
- Real provider smoke verifies scope denial and audit writes.

Current evidence:
- API-key generation and validation are Power/team gated.
- Hashed key storage and key hints exist.
- `/settings/mcp` includes prerequisite- and scope-aware setup, disabled no-key connection testing, full-key guidance, a copyable bounded agent operating brief, connection testing that initializes MCP and verifies tool discovery, and activity surfaces with mutation intent and safe argument-key summaries.
- `/api/mcp/events` filters activity by the authenticated user as well as relying on database policies.
- `npm run smoke:mcp` can verify read-only scoped keys deny writes and, with `--provision --write --audit`, create disposable scoped keys and verify real audit writes.
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
- Real Supabase migrations, auth, RLS, task CRUD, task-note CRUD, profile insert/read/update grants and content bounds, task/task-relationship/task-note column grants and content bounds, Stripe event record privacy/write denial, usage-event mutation denial, rate-limit bucket privacy, daily briefing cache write denial, quota, uniqueness, and audit smoke.
- Real authenticated app API task CRUD, task-note, and agent-review route smoke with `npm run smoke:app`.
- Real OpenAI parse, prioritize, briefing, and execution smoke. `npm run smoke:openai -- --app` can verify the authenticated app routes against a disposable Supabase user once real OpenAI/Supabase/app env is loaded.
- Stripe test-mode checkout, portal, signed webhook, entitlement, quota, and idempotency smoke. `npm run smoke:stripe -- --write --webhook` now covers authenticated checkout and portal routes, signed webhook delivery, unknown-price fail-closed behavior, free/pro/power tier transitions, payment-failure downgrade to Free, quota plan-state boundaries, authenticated `POST /api/tasks` quota behavior under those tiers, and duplicate webhook replay.
- Real MCP/API-key execution, read-only denial, idempotency replay, and audit-write smoke.
- Quill/founder approval for public copy.
- Approval for any production deploy or public launch commitment.

## Next product hardening after MVP
- Run the full technical launch smoke against a real preview URL and real provider env.
- Verify import preview quota warnings against a real Supabase profile near the monthly task limit; local helper coverage already verifies the warning copy and cap math.
- Verify agent output history and review-note persistence against a real authenticated Supabase task.
- Verify scoped MCP idempotency replay, read-only denial, and audit rows against real task data.
- Decide the first revenue wedge before broadening integrations or agent action types.
