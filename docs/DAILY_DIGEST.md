# Daily Digest

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
- Added scoped API key permissions, scope-filtered MCP tool listings, REST/JSON-RPC scope enforcement, and an agent action audit table/migration.
- Gated API-key generation and MCP API-key validation to Power/team profiles, and disabled free-plan API-key generation in settings.
- Wired settings tab query parameters so quota/API upgrade links land directly on billing.
- Pointed Stripe checkout and portal return URLs at the billing settings tab.
- Added rate limiting to API key rotation for scoped MCP/API keys.
- Moved MCP/API keys to hashed storage with one-time reveal, display hints, legacy key migration, and fallback validation.
- Narrowed browser-visible profile columns and direct profile self-updates so signed-in clients cannot read key hashes/Stripe IDs or self-change billing, quota, Stripe, or API-key state.
- Made the MCP settings tool list reflect the current API key scopes.
- Added a recent agent activity surface on the MCP settings page backed by `/api/mcp/events`.
- Added idempotency handling for agent task creation using `source_agent_id` plus `external_ref`, including write-smoke replay coverage.
- Opened PR #3 and verified GitHub Actions Web rails plus Vercel preview deployment.
- Updated vision, roadmap, backlog, decisions, metrics, marketing, and research docs to align with the current implementation.
- Restored stricter build rails by adding typecheck/e2e scripts and removing build-time TypeScript/ESLint ignores.
- Added deterministic local task intelligence for demo-mode parsing, prioritization, briefing, and bounded research/draft/prep outputs.
- Refreshed logged-out daily briefings from local demo task state after task capture/import.
- Persisted logged-out demo task changes to localStorage so added, imported, edited, completed, and deleted demo tasks survive reloads.
- Aligned the exported demo task updater with the main store so non-status edits preserve completion timestamps.
- Persisted logged-out demo profile changes to localStorage so no-auth settings saves stay functional.
- Kept demo profiles out of authenticated UI state so no-auth demo mode does not expose sign-out or authenticated profile-save behavior.
- Added client-side demo file import parsing for CSV, JSON, and ICS, with browser smoke coverage that verifies a logged-out CSV import appears in the task list.
- Prevented authenticated task-capture save failures from creating local-only demo tasks; failed saves now restore the input and show an error.
- Moved AI route body validation before rate-limit consumption for parse, prioritize, and briefing requests.
- Sanitized prioritization and briefing task arrays before rate-limit consumption and AI provider/fallback execution.
- Added bounded validation for OpenAI JSON responses before parsed tasks, prioritization, briefings, or research/draft/prep agent outputs are returned or saved.
- Hardened task mutation routes so PATCH only accepts user-editable fields and DELETE reports missing owned tasks.
- Rolled back failed authenticated task edits/deletes and surfaced task-store errors through visible notifications.
- Made the task detail panel's edit action functional for the MVP task fields.
- Removed nonfunctional theme and notification controls from the app shell/settings for launch truthfulness.
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
- Added Playwright smoke coverage for the logged-out core product path.
- Added Playwright smoke coverage for All Tasks search/filtering, Upcoming grouping, and Done clear/reload lifecycle in demo mode.
- Added Playwright smoke coverage for OpenAPI action schema, MCP/action auth failures, and action CORS headers.
- Made the ChatGPT Actions OpenAPI spec emit the serving request origin when `NEXT_PUBLIC_APP_URL` is not configured.
- Added GitHub Actions verification for install, lint, typecheck, build, and Playwright smoke testing.
- Hardened authenticated task creation with explicit validation/normalization before task quota is consumed.
- Upgraded to Next.js 16, ESLint 9 flat config, and a PostCSS override; `npm audit --audit-level=moderate` now reports 0 vulnerabilities.
- Moved the Next middleware entrypoint to the Next 16 `proxy.ts` convention.
- Hardened profile updates with allowlisted timezone/work-type values and name length normalization.
- Fixed mobile startup so the navigation drawer does not cover the main task screen by default.
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
