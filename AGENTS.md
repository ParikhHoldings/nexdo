# AGENTS.md

## Mission
This repository supports Nexdo, an AI-native task manager aimed at turning captured tasks into prioritized, contextual, execution-oriented work.

The operating mission is to make Nexdo credible as a real product: keep the promise concrete, keep the build/deploy rails verified, and convert founder input into shipped product, roadmap updates, and bounded follow-up tasks.

## Product Truth Snapshot
Last repo-context pass: 2026-05-17.
Last local verification: 2026-05-17.

Nexdo is not only a concept. The repo already contains a Next.js product shell with:
- marketing, auth, app, settings, import, and MCP setup routes under `app/`
- task capture, task cards, detail panel, sidebar, daily briefing, pricing, imports, and UI primitives under `components/`
- Supabase auth/data helpers, generated DB types, task/demo data, OpenAI prompts and calls, quotas, rate limits, Stripe helpers, import normalization, and MCP tools under `lib/`
- Supabase migrations for profiles, tasks, task notes, daily briefings, RLS, usage events, quota cleanup, rate limits, webhook idempotency, and performance indexes under `supabase/migrations/`
- API routes for tasks, AI parse/prioritize/briefing/agent execution, imports, profile/API keys, Stripe checkout/portal/webhook, MCP JSON-RPC, MCP actions, and OpenAPI for ChatGPT Actions under `app/api/`

The product promise should be grounded in what the code actually supports:
- natural-language task capture with AI parsing, including due-date and due-time extraction; local fallback parsing should keep titles concise by moving schedule, priority, and estimate phrases into structured metadata
- priority, due date, context, people, tags, action type, estimate, and energy metadata
- task-detail notes for human context, decisions, links, and future agent handoff context, with demo localStorage persistence, authenticated owned-task note routes, and MCP/ChatGPT Actions support for external agents to append reviewable task notes
- daily briefing and prioritization generated from task context, with cached briefing rows kept service-owned if the cache table is used
- limited agent execution for owned `research`, `draft`, and `prep` task records, with server-side output persistence, run history, and user verification notes; `manual` and `remind` tasks are not executable AI-agent tasks
- localStorage-backed demo-mode task and profile data when Supabase is unavailable or the visitor is logged out, so logged-out changes survive reloads
- persistent dark/light appearance preferences for the app workspace
- local-date-aware browser due-task reminders for active tasks due today or overdue, permission-gated and sent once per task per day while the app is open
- imports from Todoist, manual Google/Microsoft access-token imports, plus CSV, ICS, JSON/Trello/Things-style sources, with client-side demo file imports, file previews before mutation, visible workspace hydration after authenticated import success, and task quota enforcement for authenticated imports
- API key based MCP/ChatGPT Actions interop for listing, creating, completing, updating, adding notes to, searching, reading, and briefing tasks; agent task updates can maintain core planning metadata such as due time, action type, estimate, energy, people, tags, and the full task status contract including `cancelled`; cancelled work remains visible and restorable in the human All Tasks flow
- Power/team-gated API-key access, scoped API-key permissions, rotation rate limits, prerequisite- and scope-aware MCP setup UI, and an agent action audit table/migration for MCP/API-key calls; MCP tool execution pre-creates the audit row and fails before handler mutation if audit logging is unavailable
- Connect AI setup and settings UI should keep API access clearly gated to Power/team plans until pricing or entitlement truth changes
- hashed API-key storage with one-time key reveal, short key hints in settings, and legacy raw-key migration/fallback
- narrowed browser-visible profile columns, direct profile inserts, and direct profile self-updates so profile rows stay server-owned while clients can read/edit bounded preferences without direct access to Stripe IDs, raw/hash API-key material, quota internals, or billing mutation fields
- narrowed direct browser task insert/update columns so agent output, the broad task source flag, source-agent metadata, ingestion intent, completion timestamps, and task relationship metadata remain server-managed, with database bounds on user-editable task content
- narrowed direct browser task-note insert/update columns so note type and creation time remain server-managed while bounded note content stays user-editable
- authenticated import routes persist imported task rows through the service-role path after auth/quota checks so imported completion timestamps and external source references can be kept without reopening those columns to direct browser writes
- bounded OpenAI response validation for task parsing, prioritization, briefing, and research/draft/prep output before provider content is returned or persisted
- shared task-create and task-patch validation in `lib/task-validation.ts`, so human task routes reject protected/server-managed fields before quota consumption or database mutation; authenticated task creation writes through the service-role path after validation/quota checks so validated non-agent `source` values can persist without reopening direct browser writes
- shared local date/time normalizers in `lib/dates.ts`; human task validation, AI task sanitization/output validation, deterministic fallback parsing, import parsing, and MCP task updates should reject impossible due dates and out-of-range due times before persistence or planning use
- a recent agent activity surface under `/settings/mcp`
- idempotent agent task creation when callers provide `source_agent_id` plus `external_ref`
- agent trace metadata on create, update, complete, and task-note MCP writes so source agents and external references can be audited; `external_ref` requires `source_agent_id` on these writes, and create, update, and complete also persist trace metadata on the task row for human review
- Stripe-backed plan surfaces, quotas, and rate-limit scaffolding, with checkout price IDs derived from server configuration, unknown webhook prices skipped instead of granting paid access, webhook idempotency records kept service-owned, and quota/rate-limit telemetry kept service-mutated

Do not claim verified production readiness until build, lint, environment, database migrations, auth, Stripe, OpenAI, MCP, and deployment target have been checked in the current environment.

Current local verification from 2026-05-17:
- `npm ci` passed from the lockfile
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed with strict TypeScript and ESLint checks enabled
- `npm run test:e2e` passed for 101 tests covering public landing/signup demo CTA smoke, logged-out demo workflows, task workspace lifecycle, task-detail notes save/reload behavior, Today focus/sidebar/briefing alignment for undated active tasks and cancelled-only work, mobile navigation open/close behavior, local-date due-today behavior, file-import preview/confirm flow, agent output history/review notes, persistent appearance and browser reminder settings, task/agent auth guards, shared executable action-type rails that keep `manual`/`remind` tasks out of AI execution controls, owned task-note route guardrails, authenticated app smoke source coverage for task CRUD and notes, profile/task/task-relationship/task-note/Stripe event/usage/rate-limit/daily-briefing grant source coverage, MCP/OpenAPI/action auth smoke tests, API-to-Connect-AI handoff coverage, DB-backed MCP handler and API-key validation coverage including audit preflight failure behavior and `add_task_note` append/readback behavior, agent-completed trace visibility, billing guardrails, deterministic task-intelligence coverage including relative-date title cleanup, import parser coverage, Stripe entitlement mapping, task route validation, local validation helper contracts, invalid date/time rails, MCP/OpenAPI `cancelled` status contract alignment, and cancelled-task UI review/restore coverage
- `npm audit --audit-level=moderate` passed with 0 vulnerabilities after the Next.js 16 / ESLint 9 upgrade
- `npm run smoke:launch -- --skip-local --skip-providers --technical-only` passed as a partial technical launch smoke; provider smokes, public-copy approval, and production deploy approval remain separate manual gates
- `npm run verify:env` failed because `.env.local` is absent; only `.env.local.example` exists in this workspace

Current PR verification from this pass:
- GitHub Actions Web rails run on pull requests and pushes to `main`/`staging`, with install, lint, typecheck, build, dependency audit, and Playwright smoke testing.
- Most recently inspected before this docs refresh: PR #3 head `74f3b79623c2c0fa26bb166c91d05d7e930a9e3f` passed GitHub Actions Web rails after the task-parse input hardening change.
- Vercel preview deployment evidence remains per-head: earlier inspected heads passed, while the latest inspected head `74f3b79623c2c0fa26bb166c91d05d7e930a9e3f` hit the known account build-rate-limit status instead of proving a fresh preview deployment. Recheck PR status after every newer push.
- Direct remote route smoke against the current protected preview URL failed on 2026-05-17 at `/` because Vercel Deployment Protection is still active; provide `VERCEL_AUTOMATION_BYPASS_SECRET` locally or use an unprotected preview/production URL before treating route smoke as verified.
- Always inspect current PR checks after later pushes before treating preview deploy as current-green. A Vercel build-rate-limit failure is not evidence of an app build failure, but it does mean that head does not have fresh preview-deploy evidence.

Production environment, Supabase migrations, OpenAI provider calls, Stripe test-mode flows, scoped MCP/API-key execution, idempotency replay against real task data, agent audit writes, and production deployment rails remain unverified in this pass.

## ICP And Positioning
- Primary ICP: founders, operators, and AI power users with too many moving priorities and too much task context trapped in notes, chat, email, and other tools.
- Secondary ICP: teams that need a task layer more execution-oriented than static checklists.
- Core promise: Nexdo helps users move from task capture to forward motion by making planning, prioritization, context, and execution support more proactive.
- Product wedge: tasks should carry enough context for AI and external agents to help decide what matters and perform bounded work, not just store a checklist item.

## Current Priorities
1. Verify and standardize repo/build/deploy rails.
2. Turn the current implementation into a narrow, trustworthy MVP path.
3. Audit public-facing claims against verified product behavior.
4. Harden the task/AI/API/MCP/Stripe surfaces enough for credible early users.
5. Maintain docs as the source of operational truth.

## Architecture Notes
- Framework: Next.js 16 app router, React 18, TypeScript, Tailwind, Framer Motion, lucide-react.
- Data/auth: Supabase SSR/client helpers and RLS-backed tables.
- AI: OpenAI chat completions via helpers in `lib/openai.ts`; prompts live in `lib/prompts.ts`; provider response validation lives in `lib/ai-response-validation.ts`.
- Executable task actions: the shared bounded execution contract lives in `lib/task-actions.ts`; task cards, task detail, authenticated execution, and agent-output history should use it so only `research`, `draft`, and `prep` expose AI execution.
- Task schedule metadata: local date-key and due-time helpers live in `lib/dates.ts`; reuse them for any new task ingestion, AI, import, or MCP path instead of regex-only validation.
- Billing: Stripe helpers and plan limits in `lib/stripe.ts`; checkout, portal, and webhook routes under `app/api/stripe/`. Checkout accepts only server-known `pro`/`power` plan keys, and webhook tier updates require explicit Stripe price ID mappings.
- Agent interop: MCP definitions and handlers in `lib/mcp-tools.ts`; JSON-RPC MCP endpoint at `app/api/mcp/route.ts`; ChatGPT Actions OpenAPI at `app/api/mcp/openapi/route.ts`; action wrappers under `app/api/mcp/actions/[tool]/route.ts`. Keep MCP tool schemas, OpenAPI enums/nullability, trace requirements, and handler validation aligned when task statuses or fields change.
- Agent request validation: MCP JSON-RPC `tools/call` and ChatGPT Action wrappers should reject non-object tool argument payloads before tool execution so arrays, strings, and `null` bodies cannot be silently treated as valid arguments.
- Agent governance: API key scopes are modeled in `lib/agent-scopes.ts`; key generation/hashing helpers live in `lib/api-keys.ts`; hashed keys and key hints are persisted on profiles; agent calls preflight and finalize `agent_action_events` rows, and audit write failures should not be swallowed.
- Task notes: shared note validation and demo persistence live in `lib/task-notes.ts`; authenticated owned-task note routes live at `app/api/tasks/[id]/notes/route.ts`; `add_task_note` in `lib/mcp-tools.ts` is the external-agent note append path; task detail is the human-facing notes surface. Task-note metadata is column-limited by migration `008_task_note_column_grants.sql`, and server routes should write note metadata through service-role paths after ownership checks.
- Imports: source-specific and generic normalization in `lib/importers.ts`; import routes under `app/api/import/`.
- Demo mode: `lib/tasks.ts` provides local demo tasks and `lib/demo-profile.ts` provides a local demo profile when Supabase is not configured or no user is authenticated; browser demo changes persist to localStorage and must never be treated as authenticated product data.

## Commands
- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- E2E smoke: `npm run test:e2e`
- Env preflight: `npm run verify:env`
- OpenAI provider smoke: `npm run smoke:openai`
- Stripe provider smoke: `npm run smoke:stripe`
- Supabase provider smoke: `npm run smoke:supabase`
- Authenticated app smoke: `npm run smoke:app`
- MCP provider smoke: `npm run smoke:mcp`
- Rendered route smoke: `npm run smoke:routes -- --url=<app-origin>`
- Full launch smoke bundle: `npm run smoke:launch`

`npm run smoke:openai` rejects missing/placeholder keys and verifies provider
JSON-mode output for parse, prioritization, briefing, and all bounded execution
types: research, draft, and prep. Add `-- --app` when Supabase service-role
env and the target app URL are loaded to create a disposable user and verify
authenticated parse, prioritize, briefing, and research/draft/prep execution
routes against the app.
The app-route smoke uses `VERCEL_AUTOMATION_BYPASS_SECRET` for protected
Vercel previews when present.

`npm run smoke:app` requires Supabase service-role env and a target app URL.
It creates a disposable Supabase user, signs in through the app cookie flow,
then verifies authenticated task list/create/update/delete plus task-note
validation, creation, and readback. It uses
`VERCEL_AUTOMATION_BYPASS_SECRET` for protected Vercel previews when present.

`npm run smoke:stripe -- --write --webhook` posts signed test-mode
subscription events to the configured app URL, verifies unknown-price
fail-closed behavior, free/pro/power profile tier transitions, quota plan-state
boundaries for the resulting tiers, authenticated `POST /api/tasks` quota
behavior under those tiers, duplicate webhook idempotency, and cleans up
disposable Stripe/Supabase data.

`npm run smoke:mcp` accepts `NEXDO_API_KEY` for authenticated MCP initialized
notification, SSE, JSON-RPC, and ChatGPT Actions checks, optional
`NEXDO_READONLY_API_KEY` for scoped read-only denial checks, and `-- --write`
for disposable task creation, structured task update, note append, completion,
plus idempotency checks. Add
`--provision` when Supabase service-role env is loaded to create disposable
full-access and read-only Power-plan API keys instead of using pre-generated
keys. Add
`--audit` to the write smoke when
`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are loaded and the
run must prove `agent_action_events` audit rows were written. The write smoke
also verifies `complete_task` returns the completed task with agent trace
metadata persisted on the task row.
It uses `VERCEL_AUTOMATION_BYPASS_SECRET` for protected Vercel previews when
present.

`npm run smoke:supabase -- --write` should verify real migrations, profile
column grants, direct task and task-note column-grant denials for
server-managed fields, task-source spoofing, task relationship write denial,
task content bounds, agent external-ref uniqueness, private audit-event reads,
browser audit-event insert denial, service-owned Stripe webhook event records,
quota increments/no-ops, usage-event mutation denial, rate-limit bucket privacy,
daily briefing cache write denial, and rate-limit allow/block behavior.

`npm run smoke:routes -- --url=https://preview.example` verifies the
launch-facing marketing, app, login/signup/password-reset auth, import,
settings, MCP setup, privacy, and terms routes at desktop and mobile widths.
It checks for successful responses,
meaningful rendered body text, page titles, framework/runtime overlays, and
browser console errors. Add `--screenshot-dir=/tmp/nexdo-routes` when visual
evidence is useful.

`npm run smoke:launch -- --env=.env.production.local --url=https://preview.example --technical-only`
loads the env file into child processes, runs local rails, runs rendered route,
Supabase, authenticated app, OpenAI, Stripe, and MCP provider smokes in order, and stops short of
claiming launch approval. Provider smokes in the launch bundle require a remote
HTTPS `--url` or `NEXT_PUBLIC_APP_URL`; use `--allow-local-url` only for
intentional local provider debugging, not launch evidence. Omit
`--technical-only` only when public copy approval and production deploy
verification can be represented with explicit `--copy-approved` and
`--production-deploy-verified` flags.

Use the smallest relevant verification. For docs-only changes, a diff review is usually enough. For code changes, prefer `npm run lint`, `npm run typecheck`, and `npm run build` when dependencies and environment allow it. For launch-facing app behavior, run `npm run test:e2e` as well. If a check cannot run, record why and add a follow-up task.

## Environment
Use `.env.local.example` as the contract:
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- OpenAI: `OPENAI_API_KEY`; optional `OPENAI_MODEL` defaults to `gpt-4o`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRO_PRICE_ID`, `STRIPE_POWER_PRICE_ID`
- App origin: `NEXT_PUBLIC_APP_URL`

Never invent environment truth. Confirm configured values exist before treating auth, AI, billing, imports, MCP, or production URLs as working.
Use `lib/env.ts` for runtime placeholder-risk checks so copied example values fail closed consistently.
`NEXDO_API_KEY` and `NEXDO_READONLY_API_KEY` are smoke-only variables for `npm run smoke:mcp`; they are not app runtime requirements.
Use `docs/DEPLOYMENT.md` for local no-provider setup, production setup sequence, provider smoke commands, rollback notes, and deployment approval boundaries.
Use `.env.production.local.example` as the concrete template for preview or production smoke env files; copy it to `.env.production.local` and keep the copied file untracked.

## General Operating Rules
- Operate proactively.
- Convert founder input into roadmap updates, backlog items, implementation, and digest notes.
- Prefer momentum through small, bounded, reversible tasks.
- Keep documentation aligned with reality whenever product, build, deploy, pricing, or positioning truth changes.
- Create follow-up tasks whenever work is deferred, partially completed, blocked, or needs verification.
- Minimize unnecessary confirmations inside the safe boundaries below.
- Do not let vague AI-native positioning substitute for concrete product behavior.
- Preserve user changes. Do not revert unrelated work unless explicitly requested.

## Approval Boundaries
Require approval before:
- public launch copy goes live
- pricing changes or new plan commitments
- public posting, outreach, or announcements
- production deploys
- customer-facing commitments beyond verified product truth
- destructive data, auth, billing, or migration operations

## Safe Autonomous Actions
The agent may do these without asking:
- create or update internal docs
- create and reprioritize backlog items
- perform research
- draft product and marketing assets for review
- tighten MVP framing and repo/deploy requirements
- improve internal planning and execution scaffolding
- fix low-risk bugs
- add tests
- open PRs

## Public Copy Guardrails
- Public-facing copy must be routed through Quill before real external use.
- Before launch, audit `app/(marketing)/page.tsx` for claims that may outrun verified truth, especially claims around "actually does your tasks", "thousands of users", security, integrations, and production readiness.
- Prefer specific behavior claims over broad productivity language.
- Keep site metadata and agent prompts aligned with early-access, bounded, reviewable AI assistance. Do not reintroduce broad autonomous automation language without verified product behavior.
- Keep public crawl/legal surfaces consistent with real files and verified behavior. If `robots.txt` advertises a route, verify that route exists.
- Do not describe MCP, imports, agent execution, billing, or security as fully production-ready until they are verified end to end.

## Definition Of Done
A task is done only when:
- the implementation or artifact is complete
- relevant checks pass, or the reason they could not run is documented
- docs are updated if reality changed
- PR or summary explains what changed and why
- follow-up tasks are created for anything deferred

## Review Checklist
For each meaningful change, verify:
- usefulness to the real product path
- clarity of product promise
- docs updated if needed
- overpromising risk avoided
- roadmap remains grounded in verified reality
- build/deploy or env assumptions are labeled as verified or unverified

## Documentation Rules
Maintain these files as part of the operating layer:
- `README.md`
- `docs/VISION.md`
- `docs/MVP.md`
- `docs/LAUNCH_PLAN.md`
- `docs/COMPLETION_AUDIT.md`
- `docs/DEPLOYMENT.md`
- `docs/ROADMAP.md`
- `docs/BACKLOG.md`
- `docs/DECISIONS.md`
- `docs/METRICS.md`
- `docs/MARKETING.md`
- `docs/RESEARCH.md`
- `docs/DAILY_DIGEST.md`

Other Markdown/text files agents should remember:
- `.github/pull_request_template.md`
- `AGENTS.md`
- `public/robots.txt`

## Daily Digest Format
Provide a concise digest with:
- shipped
- in progress
- blocked
- approvals needed
- recommended next focus

## Priority Order
When choosing work, generally prioritize:
1. repo/deploy verification and active-product rails
2. revenue-enabling MVP clarity
3. user-facing product hardening
4. marketing/distribution leverage
5. documentation cleanup

## Execution Style
- Read the relevant code and docs before making product assertions.
- Do not wait passively if safe work exists.
- Do not endlessly plan without shipping.
- Break large goals into smaller bounded tasks.
- Make Nexdo more real each cycle.
