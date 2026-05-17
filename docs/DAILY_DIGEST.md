# Daily Digest

## 2026-05-17
### Shipped
- Moved human task-create and task-patch validation into shared `lib/task-validation.ts`.
- Made generic task create/update routes reject protected or server-managed fields before quota or database mutation.
- Added focused coverage for task creation normalization and task patch allowlisting.
- Tightened the landing page draft around the verified demo path and bounded AI assistance.
- Added Playwright coverage for the landing page primary CTA routing to `/today`.
- Added a direct signup-page demo path with browser coverage.
- Deep-linked Connect AI no-key guidance to `/settings?tab=api` and covered it with a regression check.
- Restored failed authenticated Done-page bulk deletes back into local state and updated the failure toast.
- Moved authenticated human task creation to quota pre-check, post-insert usage accounting, and task cleanup when accounting fails.
- Moved MCP `create_task` to idempotency replay, quota pre-check, post-insert usage accounting, and cleanup when accounting fails.
- Moved authenticated imports to quota pre-check, post-save accounting for successfully inserted rows, and cleanup when accounting fails.
- Hardened billing profile persistence so checkout and webhook entitlement updates no longer silently ignore failed profile writes.
- Hardened API-key rotation persistence so generated one-time keys are not returned unless the hashed key and scopes are written.
- Made owned task PATCH misses return 404 instead of generic Supabase no-row failures.
- Made agent execution quota pre-check failures return service-failure status when quota/profile state cannot be verified.
- Made profile update misses return 404 instead of generic Supabase no-row failures.
- Made MCP task read/update/complete calls return stable not-found errors for missing or unowned task IDs.
- Kept authenticated app boot coherent when profile rows are missing or delayed by using a safe fallback profile and visible load errors.
- Surfaced authenticated task-capture server messages for profile, quota, and save failures.
- Surfaced authenticated task edit/delete server messages while preserving optimistic rollback.
- Surfaced authenticated import server messages before generic import errors.
- Surfaced authenticated Done-page bulk-delete server messages while preserving local rollback.
- Made Google Tasks and Microsoft To Do imports fail closed on nested provider task-list fetch failures.
- Exposed Google Tasks and Microsoft To Do as manual access-token imports and kept full OAuth explicitly post-launch.
- Surfaced authenticated agent-execution and agent-review server messages in task detail.
- Added due-time and energy-level editing/display to task detail so the MVP task structure is editable from the core workspace.
- Carried parsed due times from natural-language capture through demo tasks, authenticated task creation, MCP-created tasks, validators, and OpenAI smoke expectations.
- Tightened shared task date/time validation so human routes, AI task sanitization/output validation, and MCP updates reject impossible calendar dates and out-of-range local times.
- Moved deterministic fallback task parsing onto the shared due-date normalizer for explicit dates.
- Moved import date/time parsing onto the shared schedule normalizers and preserved Google/Microsoft due times from imported datetime fields.
- Removed UTC date parsing from demo upcoming filtering, All Tasks due-date sorting, and OpenAI provider smoke date fixtures.
- Refreshed `AGENTS.md` with the shared date/time validation contract and current PR #3 verification state.
- Made prioritization and briefing context due-time-aware, with deterministic ranking for same-day timed tasks.
- Refreshed daily briefings when structured planning metadata changes and treated past due times today as overdue.
- Fixed date-only task labels so local calendar due dates render as Today/Tomorrow instead of shifting through UTC parsing.
- Surfaced authenticated AI briefing/prioritization fallback notices when provider or rate-limit failures force local heuristics.
- Surfaced billing checkout and portal server messages before generic settings errors.
- Kept Connect AI setup, activity, and tool indicators bound to active paid API access instead of stale key hints.
- Normalized Connect AI test-connection and agent-activity error messages across plain, message, and JSON-RPC payloads.
- Expanded Connect AI agent activity rows with mutation intent, safe argument-key summaries, and agent-metadata presence.
- Expanded `npm run smoke:mcp` to cover OpenAPI availability, ChatGPT Actions `list_tasks` shape, and real `agent_action_events` audit rows when run with `--write --audit`.
- Expanded MCP smoke execution across search, briefing, get-task, update, complete, and ChatGPT Actions search/list checks instead of only checking tool listing.
- Expanded MCP `update_task`, OpenAPI, local handler coverage, and the provider smoke path so agents can update due time, action type, estimate, energy, people, and tags.
- Expanded MCP smoke to verify the authenticated SSE endpoint advertises the JSON-RPC endpoint before tool execution.
- Made the MCP endpoint accept the standard initialized notification without a JSON-RPC `id`, and added it to the real-key MCP smoke.
- Added MCP smoke `--provision` mode to create disposable full/read-only Power-plan API keys for scoped real endpoint verification.
- Added `npm run smoke:launch` to load a real env file, run local rails, execute Supabase/OpenAI/Stripe/MCP provider smokes in order, and keep public-copy/deploy approvals explicit.
- Hardened `npm run smoke:launch` so provider smokes require an explicit remote HTTPS app URL unless local debugging is intentionally allowed.
- Made landing-page pricing CTAs route to demo, signup, or sales email instead of rendering inert upgrade buttons before production checkout is verified.
- Narrowed pricing feature bullets so public-facing plan cards no longer imply verified SSO, admin controls, team collaboration, or custom integrations.
- Tightened metadata and agent system prompt language toward early-access, bounded, reviewable AI assistance instead of broad automation claims.
- Added the public sitemap route advertised by `robots.txt` and tightened manifest/privacy/terms wording around bounded assistance and provider-backed safeguards.
- Surfaced agent-origin trace metadata on task cards and task detail so humans can identify tasks created or updated by external agents.
- Removed the dead import-card OAuth/coming-soon branch so new import cards must use a wired token or file path.
- Added optional trace metadata to `complete_task` so agent completion calls can carry `source_agent_id`, `external_ref`, `ingestion_intent`, and bounded metadata into audit rows.
- Expanded `npm run smoke:stripe -- --write --webhook` so Stripe test-mode verification can post signed webhook events, check unknown-price fail-closed behavior, verify paid/free tier transitions, and prove duplicate-event idempotency with disposable test data.
- Expanded Stripe webhook smoke to verify free/pro/power quota plan-state boundaries after signed tier-change events.
- Expanded Stripe webhook smoke to sign in the disposable Supabase user and exercise authenticated `POST /api/tasks` quota behavior under free/pro/power entitlement states.
- Expanded `npm run smoke:openai` to fail on placeholder keys and cover research, draft, and prep execution output shapes.
- Added `npm run smoke:openai -- --app` coverage for authenticated app parse, prioritize, briefing, and research/draft/prep execution routes using disposable Supabase data.
- Added task column grants so direct browser Supabase writes cannot spoof server-managed agent output, source-agent metadata, ingestion intent, or completion timestamps.
- Moved authenticated import persistence to service-role writes after auth/quota checks so imported completion timestamps and external source refs stay compatible with browser column limits.
- Expanded Supabase write smoke for task server-managed column denial, agent external-ref uniqueness, private audit-event reads, and audit-event insert denial.
- Added regression coverage for the task column-grant/service-role write boundary across task mutation, agent execution/review, and import routes.
- Moved agent execution service-role output persistence preflight ahead of rate-limit, quota, and provider work.
- Updated the GitHub Actions verify workflow to Node-24-runtime action releases while keeping the app test runtime on Node 22.
- Verified PR #3 Web rails and Vercel preview deployment after the local-date task surface rail; documented that later PR heads can still hit the Vercel account build-rate limit.
- Refreshed README, launch plan, and roadmap verification summaries so repo-facing docs matched the then-current local rail and PR check state.
- Added mobile sidebar open/close and post-navigation collapse coverage to the rendered demo smoke path.
- Tightened the Microsoft To Do import token placeholder so the rendered import card does not clip the input text.
- Tightened deterministic fallback task parsing so captured task titles stay concise while schedule, priority, and estimate phrases become structured metadata.
- Hardened `/quick` capture so empty quick-mode submissions are rejected and extra spacing is trimmed before task creation.
- Moved All Tasks and MCP `search_tasks` onto shared metadata search so people and descriptions are searchable alongside title, context, and tags.
- Aligned MCP tool schemas and ChatGPT Actions OpenAPI with handler support for the `cancelled` task status.
- Made cancelled tasks human-reviewable from All Tasks and restorable from task detail so agent-side cancellation remains visible.
- Surfaced non-default task statuses on task cards so agent-updated waiting/in-progress/cancelled work is visible while scanning the workspace.
- Aligned the Today sidebar badge with the Today focus list so undated active tasks count the same way they appear in the daily workspace.
- Aligned daily briefing, provider briefing inputs, local heuristic briefings, and due-task reminders on the same active-task definition so cancelled work does not inflate focus counts.
- Added Vercel Deployment Protection handling to the route smoke: protected previews now use `VERCEL_AUTOMATION_BYPASS_SECRET` when provided and otherwise fail with a clear blocker.
- Verified PR #3 Web rails and a Vercel preview deployment after the route-smoke rail; later PR heads can still be Vercel rate-limited.
- Added `npm run smoke:routes` and wired it into the launch smoke so preview/production route rendering is checked at desktop and mobile widths.
- Moved import preview cap warnings into a shared helper with local coverage for demo caps and Free-plan near-limit warning copy.
- Centralized executable AI action types in `lib/task-actions.ts` so task cards, task detail, authenticated execution, and agent-output history share the same research/draft/prep contract.
- Added regression coverage that `manual` and `remind` tasks stay non-executable and that reminder tasks do not expose AI-agent controls in the rendered workspace.
- Refreshed repo-facing verification summaries for the then-current 89-test local rail.
- Added task-detail notes backed by demo localStorage and authenticated owned-task note routes for human decisions, links, and future agent handoff context.
- Added regression coverage for demo task note save/reload behavior and task-note route validation/ownership rails.
- Refreshed repo-facing verification summaries for the then-current 91-test local rail.
- Added MCP/ChatGPT Actions `add_task_note` so external agents can append bounded, human-reviewable notes to owned tasks.
- Made MCP `get_task` return recent task notes and covered note append/readback through local handler, OpenAPI, action formatter, and scope tests.
- Expanded `npm run smoke:mcp -- --write` to verify JSON-RPC and ChatGPT Actions task-note appends plus note audit rows when `--audit` is enabled.
- Refreshed repo-facing verification summaries for the then-current 92-test local rail.
- Added `npm run smoke:app` to verify authenticated app-cookie task list/create/update/delete plus task-note validation/create/readback with disposable Supabase data.
- Wired `npm run smoke:app` into the launch smoke between Supabase and OpenAI provider checks.
- Refreshed repo-facing verification summaries for the latest 94-test local rail.
- Added dependency audit to the GitHub Actions Web rails and source coverage so CI matches the documented launch/deploy checklist.
- Verified PR #3 Web rails on the latest checked PR head; Vercel preview deployment and Vercel Preview Comments have passed on recent branch heads, but current-head preview evidence depends on current PR checks.
- Added a paid-key handoff from Settings > API to the Connect AI setup page so generated API keys lead directly into MCP/ChatGPT Actions setup.

### In progress
- Provider-backed Supabase, OpenAI, Stripe, and MCP smokes remain the main launch-readiness gap.

### Blocked
- `npm run verify:env` still cannot pass until `.env.local` is created with real provider values.

### Approvals needed
- Public launch copy, pricing changes, production deploys, and customer-facing commitments still require approval.

### Recommended next focus
- Configure the real provider environment and run `npm run smoke:launch -- --env=.env.production.local --url=<preview-url> --technical-only`.

## 2026-05-16
### Shipped
- Read all existing Markdown and text files in the repo, including `.github/pull_request_template.md`, `AGENTS.md`, the operating docs, and `public/robots.txt`.
- Updated the agent operating context to reflect the real Next.js/Supabase/OpenAI/Stripe/MCP product surfaces.
- Added `README.md` as a concise project overview for humans and LLM agents.
- Added `docs/MVP.md` to define the minimum human-user and AI-agent product path, acceptance gates, blockers, and post-MVP hardening queue.
- Added `docs/COMPLETION_AUDIT.md` to map the active goal to concrete evidence and remaining gaps.
- Added `docs/DEPLOYMENT.md` and `npm run verify:env` for deploy/env preflight rails.
- Aligned the env verifier with runtime placeholder-risk checks and documented smoke-only MCP API-key variables.
- Centralized runtime placeholder-risk checks for Supabase, OpenAI, Stripe, login demo-mode detection, and checkout price validation.
- Made Supabase client, server, middleware, and login demo-mode checks reject placeholder anon/service keys, not only placeholder URLs.
- Added `npm run smoke:openai` for real OpenAI JSON-mode provider verification.
- Aligned app OpenAI helpers with the `OPENAI_MODEL` smoke/env contract and placeholder-key fallback behavior.
- Added `npm run smoke:stripe` for Stripe account, price, Checkout, and Customer Portal verification.
- Added `npm run smoke:supabase` for real Supabase schema/auth/RLS/task/audit/quota/rate-limit verification.
- Added `npm run smoke:mcp` for authenticated MCP/API-key verification against a real deployment.
- Expanded MCP smoke coverage so an optional read-only scoped key can verify write tools are hidden and denied.
- Exposed agent metadata fields in MCP create/update tools so agent-created tasks can carry source identifiers and external references.
- Added bounded MCP tool input validation and made MCP `create_task` consume task-create quota.
- Aligned MCP `search_tasks` with its advertised contract by searching task metadata.
- Added scoped API key permissions, scope-filtered MCP tool listings, REST/JSON-RPC scope enforcement, and an agent action audit table/migration.
- Gated API-key generation and MCP API-key validation to Power/team profiles, and disabled free-plan API-key generation in settings.
- Wired settings tab query parameters so quota/API upgrade links land directly on billing.
- Pointed Stripe checkout and portal return URLs at the billing settings tab.
- Added rate limiting to API key rotation for scoped MCP/API keys.
- Moved MCP/API keys to hashed storage with one-time reveal, display hints, legacy key migration, and fallback validation.
- Narrowed browser-visible profile columns and direct profile self-updates so signed-in clients cannot read key hashes/Stripe IDs or self-change billing, quota, Stripe, or API-key state.
- Made the MCP settings tool list reflect the current API key scopes.
- Made the MCP settings setup flow prerequisite-aware, disabled free/no-key connection tests, and clarified that external clients need the full one-time key rather than the stored key hint.
- Added a recent agent activity surface on the MCP settings page backed by `/api/mcp/events`.
- Explicitly filtered `/api/mcp/events` by the authenticated user in addition to RLS.
- Added idempotency handling for agent task creation using `source_agent_id` plus `external_ref`, including write-smoke replay coverage.
- Aligned ChatGPT Actions response formatting through a shared helper and advertised tool validation/service-unavailable errors in the OpenAPI schema.
- Opened PR #3 and verified GitHub Actions Web rails plus Vercel preview deployment.
- Updated vision, roadmap, backlog, decisions, metrics, marketing, and research docs to align with the current implementation.
- Restored stricter build rails by adding typecheck/e2e scripts and removing build-time TypeScript/ESLint ignores.
- Added deterministic local task intelligence for demo-mode parsing, prioritization, briefing, and bounded research/draft/prep outputs.
- Added focused regression coverage for deterministic local task parsing, prioritization, briefing, and bounded execution fallbacks.
- Refreshed logged-out daily briefings from local demo task state after task capture/import.
- Refreshed authenticated daily briefings when task state or user name changes instead of keeping the first briefing stale.
- Persisted logged-out demo task changes to localStorage so added, imported, edited, completed, and deleted demo tasks survive reloads.
- Aligned the exported demo task updater with the main store so non-status edits preserve completion timestamps.
- Persisted logged-out demo profile changes to localStorage so no-auth settings saves stay functional.
- Kept demo profiles out of authenticated UI state so no-auth demo mode does not expose sign-out or authenticated profile-save behavior.
- Added client-side demo file import parsing for CSV, JSON, and ICS, with browser smoke coverage that verifies a logged-out CSV import appears in the task list.
- Added file-import previews with sample task titles and plan/cap warnings before tasks are added.
- Fixed local-date drift so due-today filters, demo seed tasks, browser reminders, MCP due-today filtering, and date-only imports do not shift after UTC midnight.
- Added agent output run history plus verification status/notes so bounded research, draft, and prep outputs stay reviewable.
- Added representative import parser coverage for Todoist, CSV, ICS, Trello JSON, Things-style JSON, and invalid JSON exports.
- Prevented authenticated task-capture save failures from creating local-only demo tasks; failed saves now restore the input and show an error.
- Prevented stale authenticated sessions from falling through to local demo task creation when Supabase returns no active user during capture.
- Moved AI route body validation before rate-limit consumption for parse, prioritize, and briefing requests.
- Sanitized prioritization and briefing task arrays before rate-limit consumption and AI provider/fallback execution.
- Added bounded validation for OpenAI JSON responses before parsed tasks, prioritization, briefings, or research/draft/prep agent outputs are returned or saved.
- Hardened task mutation routes so PATCH only accepts user-editable fields and DELETE reports missing owned tasks.
- Rolled back failed authenticated task edits/deletes and surfaced task-store errors through visible notifications.
- Made the task detail panel's edit action functional for the MVP task fields.
- Added focused helper coverage for AI task input validation, API-key scope mapping, quota response payloads, and rate-limit response headers.
- Kept launch controls truthful by backing appearance/notification settings with real local behavior and removing unbacked pricing controls.
- Aligned the Connect AI setup page with the Power-plan API access gate.
- Surfaced settings profile/API-key failures in the UI and refreshed local profile state after authenticated saves.
- Hardened authenticated agent execution so it runs only owned task records and saves output server-side.
- Hardened agent execution quota ordering so output is not saved or returned when usage recording fails.
- Fixed optimistic task updates so non-status changes no longer clear completed timestamps.
- Added batch task-quota enforcement to CSV, JSON, ICS, Todoist, Google Tasks, and Microsoft To Do imports.
- Moved CSV, JSON, and ICS imports to authenticate before reading uploaded content or request bodies.
- Made persisted `agent_output` server-managed through `/api/agent/execute` instead of generic task PATCH requests.
- Added a quota cleanup migration so usage read probes do not create zero-quantity audit events.
- Removed the annual pricing toggle because checkout currently supports only configured monthly plan prices.
- Hardened Stripe checkout and webhook entitlement handling so plan changes stay tied to server-known price IDs.
- Added Stripe price-entitlement regression coverage so missing, placeholder, or unknown price IDs cannot map to paid tiers.
- Added Playwright smoke coverage for the logged-out core product path.
- Added Playwright smoke coverage for All Tasks search/filtering, Upcoming grouping, and Done clear/reload lifecycle in demo mode.
- Added Playwright smoke coverage for OpenAPI action schema, MCP/action auth failures, and action CORS headers.
- Added DB-backed MCP tool handler and API-key validation coverage for owned reads, search, briefing, create idempotency, quota ordering, mutations, audit logging, hashed-key lookup, legacy-key migration, and paid-plan gating.
- Made the ChatGPT Actions OpenAPI spec emit the serving request origin when `NEXT_PUBLIC_APP_URL` is not configured.
- Added GitHub Actions verification for install, lint, typecheck, build, and Playwright smoke testing.
- Documented local development and production setup sequences in `docs/DEPLOYMENT.md`.
- Hardened authenticated task creation with explicit validation/normalization before task quota is consumed.
- Upgraded to Next.js 16, ESLint 9 flat config, and a PostCSS override; `npm audit --audit-level=moderate` now reports 0 vulnerabilities.
- Moved the Next middleware entrypoint to the Next 16 `proxy.ts` convention.
- Hardened profile updates with allowlisted timezone/work-type values and name length normalization.
- Fixed mobile startup so the navigation drawer does not cover the main task screen by default.
- Added real persisted dark/light appearance support before reintroducing theme controls.
- Added real local browser due-task reminders before reintroducing notification controls.
- Tightened launch-facing copy to avoid claims about open-ended task completion, large traction, and unverified enterprise readiness.
- Added `docs/LAUNCH_PLAN.md` for the Monday early-access target and long-term AI-agent path.

### In progress
- MVP path now centers on capture, structure, prioritize, brief, and bounded execution.
- Authenticated agent execution is structurally safer, but still needs real Supabase/OpenAI smoke verification.
- Import quota enforcement is in code, but still needs real Supabase smoke near plan limits.
- Agent-governance code exists locally; scoped key behavior, idempotency replay, and audit writes still need a real Supabase/API-key smoke.
- Hashed API-key storage plus profile column read/update grants exist locally, but still need real Supabase migration/write-smoke verification.
- Stripe route hardening exists locally; real test-mode checkout, portal, webhook, and quota verification still needs provider credentials.

### Blocked
- Production readiness cannot be claimed until env, migrations, auth, AI, Stripe, MCP, and deployment are verified.
- `npm run verify:env` currently fails because `.env.local` is absent; only `.env.local.example` exists in this workspace.

### Approvals needed
- Approval is still required before public launch copy, pricing changes, production deploys, or customer-facing commitments.

### Recommended next focus
- Run the new GitHub Actions workflow on a PR/branch, then smoke test Supabase, OpenAI, Stripe, and MCP flows against real environment settings.

## 2026-04-11
### Shipped
- Added the repo-level autonomous operating layer directly to the live Nexdo repo.
- Created repo-local `AGENTS.md` with Nexdo-specific mission, ICP, priorities, and operating rules.
- Added the canonical operating doc set for vision, roadmap, backlog, decisions, metrics, marketing, research, and daily digest.

### In progress
- Aligning Nexdo’s next work around repo/deploy verification and MVP clarity.

### Blocked
- No hard blocker on the operating-layer installation itself.
- The main limitation remains that repo/build/deploy truth has not yet been fully verified in the operating layer.

### Approvals needed
- Any public-facing launch or pricing commitment beyond verified reality.

### Recommended next focus
- Verify Nexdo’s real repo/deploy state and turn that into the next bounded execution queue.
