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
| Verify OpenAI provider-backed parse/prioritize/briefing/execution | Fallbacks and UI path work; real provider calls not exercised | Missing |
| Verify Stripe checkout/portal/webhook/quota updates | Code exists; Stripe test-mode flow not exercised | Missing |
| Verify authenticated MCP/API-key flow against real task data | OpenAPI/auth guardrails pass; real API-key tool execution not exercised | Missing |
| Provide a repeatable MCP/API-key smoke command | `npm run smoke:mcp` supports read-only and explicit `--write` authenticated checks | Done |
| Add scoped API keys and agent audit trails | Current API key and agent metadata fields exist; scoped permissions and audit trails are not implemented | Deferred |

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
1. Configure a real Supabase project and verify migrations, auth, profile creation, RLS, and task CRUD.
2. Exercise OpenAI-backed parse, prioritization, briefing, and bounded agent execution with real credentials.
3. Exercise Stripe checkout, portal, webhook, plan updates, quota enforcement, and idempotency in test mode.
4. Generate an API key and run authenticated MCP/ChatGPT Actions tool execution against real task data with `npm run smoke:mcp`.
5. Route public copy through Quill/founder approval before external launch use.
