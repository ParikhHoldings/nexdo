# Nexdo

Nexdo is an AI-native task manager focused on moving work from capture to forward motion. The product direction is a task layer that understands context, prioritizes intelligently, and gives AI agents a structured place to help with bounded execution work.

## Current Product Shape
This repo currently contains a Next.js app with:
- marketing, auth, task workspace, settings, import, and MCP setup routes
- Supabase-backed profiles, tasks, notes, daily briefings, usage events, and rate-limit tables
- natural-language task parsing, daily briefing, prioritization, and limited agent execution through OpenAI
- demo-mode task data when Supabase is unavailable or the visitor is logged out
- imports from Todoist and file-based task exports such as CSV, ICS, JSON/Trello/Things-style sources
- Stripe plan, checkout, portal, webhook, quota, and rate-limit scaffolding
- MCP and ChatGPT Actions surfaces for external agents to list, create, complete, update, search, and brief tasks
- scoped API-key permissions, hashed one-time-reveal API keys, restricted browser-visible profile columns, API-key rotation rate limits, scope-aware MCP setup UI, and an agent action audit table for MCP/API-key calls
- a recent agent activity surface on the MCP settings page
- idempotent agent task creation when callers provide `source_agent_id` plus `external_ref`

The current strategic priority is not more broad positioning. It is verifying build/deploy truth, tightening the MVP path, and making every public claim match what the product can actually do.

## Current Local Verification
Last checked on 2026-05-16:
- `npm ci` passed
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- `npm run test:e2e` passed for the logged-out `/today` demo flow plus MCP/OpenAPI/action auth smoke tests
- PR #3 Web rails passed in GitHub Actions
- PR #3 Vercel preview deployment completed

`npm run verify:env` currently fails because `.env.local` is absent; only `.env.local.example` exists in this workspace. Still unverified: production env, Supabase migrations/auth/profile column grants against a real project, OpenAI provider calls, Stripe test-mode flows, scoped MCP/API-key execution, idempotency replay against real task data, agent audit writes, and deployment rails. `npm audit --audit-level=moderate` passes with 0 vulnerabilities after the Next.js 16 / ESLint 9 upgrade.

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
```

## Environment
Use `.env.local.example` as the source of truth for required local variables:
- Supabase URL, anon key, and service-role key
- OpenAI API key and optional model override
- Stripe secret, webhook secret, publishable key, and price IDs
- `NEXT_PUBLIC_APP_URL`

Do not treat auth, AI, billing, MCP, imports, or deployment as verified until the relevant env and flow have been tested in the target environment.

## Operating Docs
- `AGENTS.md` is the repo-level operating contract for Codex and other LLM agents.
- `docs/VISION.md` captures the product promise and non-goals.
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
