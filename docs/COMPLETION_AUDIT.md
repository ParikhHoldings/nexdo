# Completion Audit

Date: 2026-05-16

## Objective restated
Make Nexdo a credible, launchable early-access product by Monday, 2026-05-18, with:
- an actual working product front-end instead of a non-functional shell
- immediate and long-term plans for human users and AI-agent users
- core launch features filled in for the MVP path
- verified build/test rails
- clear evidence for what is done, unverified, blocked, or deferred

## Prompt-to-artifact checklist

| Requirement | Evidence | Status |
| --- | --- | --- |
| Read and understand existing Markdown/text files | `README.md`, `AGENTS.md`, docs updated after reading all repo Markdown/text files including `public/robots.txt` and `.github/pull_request_template.md` | Done |
| Update `AGENTS.md` for Codex/LLM project understanding | `AGENTS.md` now includes product truth, architecture, commands, env contract, verification state, and doc rules | Done |
| Provide immediate plan | `docs/LAUNCH_PLAN.md` Monday 2026-05-18 section | Done |
| Provide long-term plan | `docs/LAUNCH_PLAN.md` human-user, AI-agent, and long-term direction sections | Done |
| Make front-end usable for humans today | Logged-out `/today` demo flow supports task capture, structured parsing, briefing, prioritization, task detail, and bounded agent output | Locally verified |
| Keep demo useful without provider secrets | `lib/task-intelligence.ts`, `lib/openai.ts`, `components/task-input.tsx`, `components/daily-briefing.tsx`, `components/task-detail.tsx`, `app/(app)/today/page.tsx` | Done |
| Restore strict build rails | `next.config.mjs` no longer ignores TypeScript/ESLint; scripts include `typecheck`; `npm run build` passes | Done |
| Add browser smoke coverage | `playwright.config.ts`, `tests/e2e/demo-smoke.spec.ts` | Done |
| Add AI-agent surface smoke coverage | `tests/e2e/agent-surfaces.spec.ts` covers OpenAPI schema, auth failures, and action CORS headers | Done |
| Add CI verification | `.github/workflows/verify.yml` runs install, lint, typecheck, build, and Playwright smoke tests; PR #3 Web rails passed | Done |
| Tighten public copy | `app/(marketing)/page.tsx`, auth pages, metadata, docs guardrails | Draft tightened; Quill/founder approval still required before public use |
| Remove dependency audit blocker | Next.js 16, ESLint 9 flat config, PostCSS override; `npm audit --audit-level=moderate` reports 0 vulnerabilities | Done |
| Verify deploy target and production env | No production env or deploy target credentials/config were exercised in this pass | Missing |
| Verify preview deploy rail | PR #3 Vercel preview deployment completed | Done |
| Verify Supabase migrations/auth/RLS/task CRUD against real project | Migrations and code exist, but real project smoke test was not run | Missing |
| Provide a repeatable Supabase smoke command | `npm run smoke:supabase` checks schema columns; `npm run smoke:supabase -- --write` creates/deletes a smoke auth user, verifies profile trigger, task CRUD through RLS, public RLS isolation, and audit-event access | Done |
| Verify OpenAI provider-backed parse/prioritize/briefing/execution | Fallbacks and UI path work; real provider calls not exercised | Missing |
| Provide a repeatable OpenAI smoke command | `npm run smoke:openai` verifies OpenAI JSON-mode calls for parse, prioritization, briefing, and prep-style execution shapes | Done |
| Verify Stripe checkout/portal/webhook/quota updates | Code exists; Stripe test-mode flow not exercised | Missing |
| Provide a repeatable Stripe smoke command | `npm run smoke:stripe` verifies account and recurring price configuration; `npm run smoke:stripe -- --write` creates disposable test-mode customer, checkout session, and billing portal session | Done |
| Verify authenticated MCP/API-key flow against real task data | OpenAPI/auth/scope guardrails pass; real API-key tool execution not exercised | Missing |
| Provide a repeatable MCP/API-key smoke command | `npm run smoke:mcp` supports read-only and explicit `--write` authenticated checks | Done |
| Make agent-created tasks distinguishable | MCP create/update schemas and handlers expose `source_agent_id`, `external_ref`, `ingestion_intent`, and `agent_metadata` | Done |
| Add idempotency and safer conflict handling for agent writes | `create_task` replays by `source_agent_id` + `external_ref`, migration adds `tasks_user_agent_external_ref_unique_idx`, and `npm run smoke:mcp -- --write` checks replay behavior | Implemented locally; provider verification missing |
| Add scoped API keys and agent audit trails | `supabase/migrations/003_agent_governance.sql`, settings key-scope UI, scope-aware MCP setup UI, MCP scope filtering/enforcement, `agent_action_events` logging, `/api/mcp/events`, and the MCP settings activity list exist; real Supabase migration/audit-write smoke still required | Implemented locally; provider verification missing |

## Commands verified locally
- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:e2e`
- `npm audit --audit-level=moderate`
- `git diff --check`
- PR #3 GitHub Actions Web rails
- PR #3 Vercel preview

## Current completion judgment
The Monday early-access demo and local build/test rails are in materially better shape and are locally verified. The broader objective is not complete as a production launch because provider-backed flows, real database/auth, Stripe billing, authenticated MCP tool execution, deployment rails, and approvals remain unverified.

## Next required work
1. Configure a real Supabase project and run `npm run smoke:supabase -- --write` to verify migrations, auth, profile creation, RLS, task CRUD, and audit events.
2. Run `npm run smoke:openai`, then exercise OpenAI-backed parse, prioritization, briefing, and bounded agent execution through the app with real credentials.
3. Run `npm run smoke:stripe -- --write`, then exercise Stripe webhook delivery, plan updates, quota enforcement, and idempotency in test mode.
4. Generate scoped API keys and run authenticated MCP/ChatGPT Actions tool execution, idempotency replay, and audit-write checks against real task data with `npm run smoke:mcp -- --write`.
5. Route public copy through Quill/founder approval before external launch use.
