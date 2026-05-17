# Nexdo

Nexdo is an AI-native task manager focused on moving work from capture to forward motion. The product direction is a task layer that understands context, prioritizes intelligently, and gives AI agents a structured place to help with bounded execution work.

## Current Product Shape
This repo currently contains a Next.js app with:
- marketing, auth, task workspace, settings, import, and MCP setup routes
- Supabase-backed profiles, tasks, notes, daily briefings, usage events, and rate-limit tables
- natural-language task parsing with due-date/due-time extraction, concise fallback titles, daily briefing, prioritization, and limited agent execution through OpenAI
- bounded validation for OpenAI JSON output before parsed tasks, briefings, prioritization, or agent results are returned or saved
- shared task-create and task-patch validation that rejects protected/server-managed fields before quota or database mutation
- reviewable agent output history with verification status and notes for bounded research, draft, and prep runs
- localStorage-backed demo-mode task and profile data when Supabase is unavailable or the visitor is logged out
- persistent dark/light appearance preferences for the app workspace
- local-date-aware browser due-task reminders for active tasks due today or overdue
- imports from Todoist, manual Google/Microsoft access-token imports, and file-based task exports such as CSV, ICS, JSON/Trello/Things-style sources, including client-side demo file imports for logged-out visitors
- file-import previews with sample task titles and plan/cap warnings before tasks are added
- Stripe plan, checkout, portal, webhook, quota, and rate-limit scaffolding
- MCP and ChatGPT Actions surfaces for external agents to list, create, complete, update, search, and brief tasks, including updates to core planning metadata such as due time, action type, estimate, energy, people, tags, and supported task statuses including `cancelled`; cancelled work remains human-reviewable and restorable from All Tasks
- Power/team-gated API access, scoped API-key permissions, hashed one-time-reveal API keys, restricted browser-visible profile columns, API-key rotation rate limits, prerequisite- and scope-aware MCP setup UI, and an agent action audit table for MCP/API-key calls
- direct browser task writes are column-limited so agent output, agent source metadata, ingestion intent, and completion timestamps stay server-managed
- a recent agent activity surface on the MCP settings page
- idempotent agent task creation when callers provide `source_agent_id` plus `external_ref`

The current strategic priority is not more broad positioning. It is verifying build/deploy truth, tightening the MVP path, and making every public claim match what the product can actually do.

## Current Local Verification
Last checked on 2026-05-17:
- `npm ci` passed
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- `npm run test:e2e` passed 87 tests covering public landing/signup demo CTA smoke, logged-out demo workflows, task workspace lifecycle, Today focus/sidebar/briefing alignment for undated active tasks and cancelled-only work, mobile navigation open/close behavior, local-date due-today behavior, file-import preview/confirm flow, agent output history/review notes, persistent appearance and browser reminder settings, MCP/OpenAPI/action auth smoke tests, DB-backed MCP handler and API-key validation coverage, MCP/OpenAPI `cancelled` status contract alignment plus cancelled-task UI review/restore coverage, billing guardrails, deterministic task-intelligence coverage, import parser coverage, Stripe entitlement mapping, task route validation, and local validation helper contracts
- `npm audit --audit-level=moderate` passed with 0 vulnerabilities
- `npm run smoke:launch -- --skip-local --skip-providers --technical-only` passed; provider smokes, copy approval, and production deploy approval remain separate gates
- PR #3 Web rails passed
- PR #3 Vercel preview deployment passed on a recent code head after the route-smoke rail
- repeated PR pushes have intermittently hit Vercel account build-rate limits, so inspect current PR checks before treating the newest head as preview-deploy verified
- the latest Vercel preview deploy is green, but direct remote route smoke is blocked by Vercel Deployment Protection until `VERCEL_AUTOMATION_BYPASS_SECRET` is provided locally or an unprotected preview URL is used

`npm run verify:env` currently fails because `.env.local` is absent; only `.env.local.example` exists in this workspace. Still unverified: production env, Supabase migrations/auth/profile and task column grants against a real project, OpenAI provider calls, Stripe test-mode flows, scoped MCP/API-key execution, idempotency replay against real task data, agent audit writes, and production deployment rails.

The Supabase provider smoke now includes task column-grant denial, audit-event privacy, audit insert denial, and agent external-ref uniqueness checks, but it still needs to be run against a real migrated project.

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
npm run smoke:mcp
npm run smoke:routes
npm run smoke:launch
```

## Environment
Use `.env.local.example` as the source of truth for required local variables:
- Supabase URL, anon key, and service-role key
- OpenAI API key and optional model override
- Stripe secret, webhook secret, publishable key, and price IDs
- `NEXT_PUBLIC_APP_URL`

Do not treat auth, AI, billing, MCP, imports, or deployment as verified until the relevant env and flow have been tested in the target environment.

For a full technical launch pass, export or provide real provider env and run:

```bash
npm run smoke:launch -- --env=.env.production.local --url=https://your-preview.example --technical-only
```

That command runs local rails plus rendered route, Supabase, OpenAI, Stripe,
and MCP provider smokes in sequence. It does not replace Quill/founder
public-copy approval or production deploy approval.

Provider smokes require a remote HTTPS `--url` or `NEXT_PUBLIC_APP_URL`. Use
`--allow-local-url` only for intentional local provider debugging, not launch
evidence.

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
