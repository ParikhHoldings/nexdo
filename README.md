# Nexdo

Nexdo is an AI-native task manager focused on moving work from capture to forward motion. The product direction is a task layer that understands context, prioritizes intelligently, and gives AI agents a structured place to help with bounded execution work.

## Current Product Shape
This repo currently contains a Next.js app with:
- marketing, auth, task workspace, settings, import, and MCP setup routes
- Supabase-backed profiles, tasks, notes, daily briefings, usage events, and rate-limit tables, with control/cache rows kept behind service-owned write paths where needed
- natural-language task parsing with due-date/due-time extraction, concise fallback titles, daily briefing, prioritization, and limited agent execution through OpenAI
- bounded validation for OpenAI JSON output before parsed tasks, briefings, prioritization, or agent results are returned or saved
- shared task-create and task-patch validation that rejects protected/server-managed fields before quota or database mutation
- task-detail notes for human context and future agent handoffs, with demo localStorage persistence, authenticated owned-task note routes, a copyable task handoff brief, `/import` paste restore for Nexdo handoff briefs, column-limited browser note metadata, database-bounded note content, and MCP/ChatGPT Actions support for external agents to append reviewable notes or bounded agent-result notes
- task-detail parent/related task links with demo persistence and an authenticated owned-relationship route that verifies linked tasks belong to the current user before service-role persistence
- reviewable agent output history with verification status and notes for bounded research, draft, and prep runs, with a shared executable-action contract that keeps manual/reminder tasks out of AI-run controls
- task cards surface non-default statuses and quick scan-view actions for starting work, marking work waiting, moving work back to to-do, and restoring done/cancelled work without opening the detail panel
- All Tasks origin filtering so human users can isolate agent-originated work for review or switch back to human-created work
- All Tasks agent-output review filtering so unreviewed/needs-revision outputs can be queued separately from verified outputs
- scan-view task cards show agent-output review badges so unreviewed, needs-revision, and verified outputs are visible before opening task detail
- sidebar Agent Review navigation deep-links to `/all?review=needs_review` with a live review-queue count
- localStorage-backed demo-mode task and profile data when Supabase is unavailable or the visitor is logged out
- persistent dark/light appearance preferences for the app workspace
- local-date-aware browser due-task reminders for active tasks due today or overdue
- imports from Todoist, manual Google/Microsoft access-token imports, Nexdo handoff briefs, and file uploads from CSV, ICS, JSON/Trello/Things-style task exports, including client-side demo file imports for logged-out visitors
- Settings data export for the tasks currently loaded in the workspace as JSON or CSV for backup, review, or agent handoff
- file-import previews with sample task titles and plan/cap warnings before tasks are added
- Stripe plan, checkout, portal, webhook, quota, and rate-limit scaffolding, with webhook idempotency records kept service-owned and quota/rate-limit telemetry kept service-mutated
- MCP and ChatGPT Actions surfaces for external agents to list, create, complete, update, add notes to, search, read, and brief tasks, including updates to core planning metadata such as due time, action type, estimate, energy, people, tags, parent/related task links, and supported task statuses including `cancelled`; cancelled work remains human-reviewable and restorable from All Tasks
- MCP JSON-RPC rejects malformed non-object request bodies before field access, and JSON-RPC plus ChatGPT Action wrappers reject malformed non-object tool argument payloads before execution, so external agents get clean validation failures for arrays, strings, or `null` bodies instead of ambiguous tool behavior; shared Bearer parsing accepts standard case-insensitive auth schemes with harmless extra spacing while still requiring a non-empty token
- Power/team-gated API access, scoped API-key permissions, hashed one-time-reveal API keys, server-owned profile rows with restricted browser-visible columns and bounded preference updates, API-key rotation rate limits, prerequisite- and scope-aware MCP setup UI, a copyable bounded agent operating brief, and an agent action audit table for MCP/API-key calls; MCP tool execution fails before handler mutation when audit logging is unavailable
- direct browser task and task-note writes are column-limited so agent output, the broad task source flag, agent source metadata, ingestion intent, completion timestamps, task relationship metadata, note type, and note creation time stay server-managed; direct task writes also have database content bounds
- a recent agent activity surface on the MCP settings page
- idempotent agent task creation when callers provide `source_agent_id` plus `external_ref`
- agent trace metadata on MCP create, update, note, and complete writes so externally advanced work remains visible in human task surfaces; agent-provided `external_ref` values require a `source_agent_id`

The current strategic priority is not more broad positioning. It is verifying build/deploy truth, tightening the MVP path, and making every public claim match what the product can actually do.

## Current Local Verification
Last checked on 2026-05-17:
- `npm ci` passed
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- `npm run test:e2e` passed 112 tests covering public landing/signup demo CTA smoke, logged-out demo workflows, task workspace lifecycle, task-card status transitions, agent-output review badges, review-queue deep-linking, All Tasks origin and agent-output review filters, task-detail notes save/reload and agent-handoff copy behavior, Nexdo handoff paste import restore with notes, task-detail relationship link save/reload/navigation behavior, Today focus/sidebar/briefing alignment for undated active tasks and cancelled-only work, mobile navigation open/close behavior, local-date due-today behavior, file-import preview/confirm flow, Settings data export downloads, agent output history/review notes, Connect AI operating brief coverage, persistent appearance and browser reminder settings, shared executable action-type rails for non-executable reminder/manual tasks, owned task-note route guardrails, authenticated app smoke source coverage for task CRUD, relationships, and notes, profile/task/task-relationship/task-note/Stripe event/usage/rate-limit/daily-briefing grant source coverage, MCP/OpenAPI/action auth smoke tests, API-to-Connect-AI handoff coverage, DB-backed MCP handler and API-key validation coverage including audit preflight failure behavior, owned relationship updates, and `add_task_note` append/readback behavior, MCP/OpenAPI `cancelled` status contract alignment plus cancelled-task UI review/restore coverage, agent-completed trace visibility, billing guardrails, deterministic task-intelligence coverage including relative-date title cleanup, import parser and handoff parser coverage, Stripe entitlement mapping, task route validation, and local validation helper contracts
- `npm audit --audit-level=moderate` passed with 0 vulnerabilities
- `npm run smoke:launch -- --skip-local --skip-providers --technical-only` passed as a partial technical launch smoke; provider smokes, copy approval, and production deploy approval remain separate gates
- GitHub Actions Web rails run on pull requests and pushes to `main`/`staging`, with install, lint, typecheck, build, dependency audit, and Playwright smoke testing
- PR #3 GitHub Actions Web rails passed on the inspected task-handoff feature head `12faf571f5f6fb453d28a6af99db99f2ec648092`; inspect current checks after every newer push before treating the branch as current-green
- Vercel preview deployment passed on the inspected task-handoff feature head `12faf571f5f6fb453d28a6af99db99f2ec648092` at `https://ph-nexdo-git-codex-launch-rea-42bdec-nathan-happywpcos-projects.vercel.app`
- direct remote route smoke against that protected preview URL is blocked by Vercel Deployment Protection until `VERCEL_AUTOMATION_BYPASS_SECRET` is provided locally or an unprotected preview URL is used

`npm run verify:env` currently fails because `.env.local` is absent; only `.env.local.example` exists in this workspace. Still unverified: production env, Supabase migrations/auth/profile plus task, task-relationship, and task-note column grants against a real project, OpenAI provider calls, Stripe test-mode flows, scoped MCP/API-key execution, idempotency replay against real task data, agent audit writes, and production deployment rails.

The Supabase provider smoke now includes profile insert denial, task source-spoof denial, task relationship write denial, task content-bound denial, task and task-note column-grant denial, audit-event privacy, audit insert denial, service-owned Stripe webhook event records, usage-event mutation denial, rate-limit bucket privacy, daily briefing cache write denial, and agent external-ref uniqueness checks, but it still needs to be run against a real migrated project.

## Stack
- Next.js 16 app router
- React 18 and TypeScript
- Tailwind CSS and Framer Motion
- Supabase auth/database/RLS
- OpenAI API
- Stripe billing

## Commands
```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
npm run test:e2e
npm run verify:env
npm run smoke:openai
npm run smoke:stripe
npm run smoke:supabase
npm run smoke:app
npm run smoke:mcp
npm run smoke:routes
npm run smoke:launch
```

## Environment
Use `.env.local.example` as the source of truth for local variables and
`.env.production.local.example` as the template for preview/production smoke
runs:
- Supabase URL, anon key, and service-role key
- OpenAI API key and optional model override
- Stripe secret, webhook secret, publishable key, and price IDs
- `NEXT_PUBLIC_APP_URL`

Do not treat auth, AI, billing, MCP, imports, or deployment as verified until the relevant env and flow have been tested in the target environment.

For a full technical launch pass, copy `.env.production.local.example` to
`.env.production.local`, replace every placeholder with real provider values,
and run:

```bash
npm run smoke:launch -- --env=.env.production.local --url=https://your-preview.example --technical-only
```

That command runs local rails plus rendered route, Supabase, authenticated app,
OpenAI, Stripe, and MCP provider smokes in sequence. It does not replace Quill/founder
public-copy approval or production deploy approval.

Provider smokes require a remote HTTPS `--url` or `NEXT_PUBLIC_APP_URL`. Use
`--allow-local-url` only for intentional local provider debugging, not launch
evidence. When `--url` is supplied, the launch smoke passes that origin into
env preflight as the `NEXT_PUBLIC_APP_URL` value so the target being smoked is
the target being validated.

## Operating Docs
- `AGENTS.md` is the repo-level operating contract for Codex and other LLM agents.
- `docs/VISION.md` captures the product promise and non-goals.
- `docs/MVP.md` defines the minimum human-user and AI-agent product path, acceptance gates, launch blockers, and post-MVP hardening queue.
- `docs/LAUNCH_PLAN.md` captures the immediate Monday launch-readiness plan and long-term agent roadmap.
- `docs/COMPLETION_AUDIT.md` maps the active goal to real evidence and remaining gaps.
- `docs/DEPLOYMENT.md` captures deploy, env, provider-smoke, and rollback rails.
- `docs/ROADMAP.md` captures current milestones and risks.
- `docs/BACKLOG.md` holds the execution queue and deferred work.
- `docs/DECISIONS.md` records durable product/repo decisions.
- `docs/METRICS.md` lists the signals that matter.
- `docs/MARKETING.md` tracks ICP, positioning, and copy guardrails.
- `docs/RESEARCH.md` tracks assumptions, competitors, and open questions.
- `docs/DAILY_DIGEST.md` keeps concise progress notes.
