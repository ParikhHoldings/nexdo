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
| Keep demo briefing aligned with task changes | Logged-out daily briefing now refreshes from local task state after demo task capture/import; Playwright verifies the active-task count updates after adding a task | Locally verified |
| Keep demo task changes across reloads | Logged-out task add/edit/delete/complete flows now persist demo task state to localStorage; Playwright verifies a new demo task survives reload and new IDs remain unique afterward | Locally verified |
| Verify demo workspace navigation and task lifecycle | Playwright now covers `/all` search/filtering, `/upcoming` date grouping, completing a task into `/done`, persistence after reload, and clearing completed demo tasks | Locally verified |
| Keep demo profile settings functional | Logged-out/no-auth profile changes save to localStorage instead of failing against the authenticated profile API; Playwright verifies demo name/timezone persist across reloads | Locally verified |
| Keep demo users out of authenticated UI state | Demo profiles no longer mark `useUserStore` authenticated, preventing signed-in-only controls such as sign-out from appearing in no-auth demo mode; Playwright covers the absence of sign-out in demo settings | Locally verified |
| Make import front-end usable in demo mode | Logged-out file imports now parse CSV, JSON, and ICS client-side instead of hitting authenticated import APIs; Playwright verifies a CSV import appears in the task list without configured auth | Locally verified |
| Keep demo entry reachable when env is placeholder/missing | Supabase client/server/middleware/login checks now reject placeholder anon/service keys as unconfigured; Playwright verifies the login page exposes demo mode without auth env | Locally verified |
| Keep demo useful without provider secrets | `lib/task-intelligence.ts`, `lib/openai.ts`, `components/task-input.tsx`, `components/daily-briefing.tsx`, `components/task-detail.tsx`, `app/(app)/today/page.tsx` | Done |
| Harden AI briefing/prioritization inputs | `lib/ai-task-input.ts` sanitizes task arrays and user names before `/api/tasks/prioritize` and `/api/briefing` consume rate limits or call OpenAI/fallback execution | Done |
| Harden AI provider output shapes | `lib/ai-response-validation.ts` validates and bounds OpenAI JSON responses for parsing, prioritization, briefing, and research/draft/prep output before runtime helpers return or persist provider content; malformed provider output falls back to local heuristics | Done |
| Harden core task mutation routes | `POST /api/tasks` validates and normalizes task payloads before quota/insert; `PATCH /api/tasks/[id]` now allowlists and validates user-editable fields; `DELETE /api/tasks/[id]` returns 404 when no owned task is deleted; e2e covers unauthenticated/config guardrails | Done |
| Make task detail editing functional | The task detail panel now has edit mode for title, context, due date, priority, action type, estimate, people, and tags; Playwright verifies demo task edits are visible before agent execution | Locally verified |
| Harden profile mutation route | `PATCH /api/profile` now validates name length, allowlisted timezone values, and allowlisted work types before updating profiles | Done |
| Harden profile/database access boundary | `supabase/migrations/005_hashed_api_keys.sql` hashes stored API keys; `supabase/migrations/006_profile_column_grants.sql` limits direct authenticated profile reads/updates to app-needed fields; sensitive billing, Stripe, raw/hash API-key, quota mutation, and entitlement state must use server/service-role paths | Implemented locally; real Supabase verification missing |
| Harden authenticated agent execution | `/api/agent/execute` now requires a `taskId`, loads the owned task from Supabase, rejects non-executable task types, records quota usage after a successful run, and only then saves `agent_output` server-side; generic task PATCH rejects client-supplied `agent_output` | Done |
| Enforce task quotas on imports | CSV, JSON, ICS, Todoist, Google Tasks, and Microsoft To Do imports now consume task-create quota in batch before saving imported tasks; migration `004_quota_noop_audit_cleanup.sql` prevents quota read probes from writing zero-quantity audit noise | Done |
| Harden file-import auth ordering | CSV, JSON, and ICS import routes now verify Supabase/auth before reading uploaded files or request bodies; e2e covers unauthenticated/config guardrails for all three | Done |
| Restore strict build rails | `next.config.mjs` no longer ignores TypeScript/ESLint; scripts include `typecheck`; `npm run build` passes | Done |
| Add browser smoke coverage | `playwright.config.ts`, `tests/e2e/demo-smoke.spec.ts` | Done |
| Add AI-agent and billing guard smoke coverage | `tests/e2e/agent-surfaces.spec.ts` covers OpenAPI schema, auth failures, action CORS headers, and unsupported Stripe checkout plan rejection | Done |
| Keep ChatGPT Actions spec bound to the serving origin | `/api/mcp/openapi` now emits the request origin when `NEXT_PUBLIC_APP_URL` is not configured, so preview/local deployments do not advertise `nexdo.ai`; Playwright verifies the local server URL | Done |
| Add CI verification | `.github/workflows/verify.yml` runs install, lint, typecheck, build, and Playwright smoke tests; PR #3 Web rails passed | Done |
| Tighten public copy | `app/(marketing)/page.tsx`, auth pages, metadata, docs guardrails | Draft tightened; Quill/founder approval still required before public use |
| Remove dependency audit blocker | Next.js 16, ESLint 9 flat config, PostCSS override; `npm audit --audit-level=moderate` reports 0 vulnerabilities | Done |
| Verify deploy target and production env | `npm run verify:env` was run on 2026-05-16 and failed because `.env.local` is absent; no production env or deploy target credentials/config were exercised in this pass | Missing |
| Keep env verification aligned with runtime placeholder rules | `scripts/verify-env.mjs` and shared runtime helper `lib/env.ts` reject common placeholder fragments across URL and secret values; `.env.local.example` documents smoke-only MCP API-key variables separately from deployed app env | Done |
| Verify preview deploy rail | PR #3 Vercel preview deployment completed | Done |
| Verify Supabase migrations/auth/RLS/task CRUD against real project | Migrations and code exist, but real project smoke test was not run | Missing |
| Provide a repeatable Supabase smoke command | `npm run smoke:supabase` checks schema columns; `npm run smoke:supabase -- --write` creates/deletes a smoke auth user, verifies profile trigger, allowed profile reads/edits, denied sensitive profile reads/edits, task CRUD through RLS, public RLS isolation, audit-event access, quota increments, quota no-op behavior, and rate-limit allow/block behavior | Done |
| Verify OpenAI provider-backed parse/prioritize/briefing/execution | Fallbacks and UI path work; real provider calls not exercised | Missing |
| Provide a repeatable OpenAI smoke command | `npm run smoke:openai` verifies OpenAI JSON-mode calls for parse, prioritization, briefing, and prep-style execution shapes; app helpers use the same optional `OPENAI_MODEL` default | Done |
| Verify Stripe checkout/portal/webhook/quota updates | Code exists; Stripe test-mode flow not exercised | Missing |
| Provide a repeatable Stripe smoke command | `npm run smoke:stripe` verifies account and recurring price configuration; `npm run smoke:stripe -- --write` creates disposable test-mode customer, checkout session, and billing portal session | Done |
| Harden Stripe plan selection and entitlement mapping | `/api/stripe/checkout` now accepts only `pro` or `power` plan keys and derives price IDs from server env; webhooks skip unknown Stripe prices instead of defaulting to paid access; e2e covers unsupported checkout plans | Done |
| Keep pricing UI aligned with billing reality | `components/pricing-table.tsx` now shows monthly pricing only because annual Stripe prices are not configured | Done |
| Verify authenticated MCP/API-key flow against real task data | OpenAPI/auth/scope guardrails pass; real API-key tool execution not exercised | Missing |
| Provide a repeatable MCP/API-key smoke command | `npm run smoke:mcp` supports authenticated read checks, optional `NEXDO_READONLY_API_KEY` scope-denial checks, and explicit `--write` task/idempotency checks | Done |
| Make agent-created tasks distinguishable | MCP create/update schemas and handlers expose `source_agent_id`, `external_ref`, `ingestion_intent`, and `agent_metadata` | Done |
| Harden MCP tool input and quota rails | MCP handlers validate bounded IDs, refs, metadata, query, task updates, and status/priority values; `create_task` consumes task-create quota after idempotency replay checks and before insert; OpenAPI exposes key length limits | Done |
| Align API access with paid plan truth | API-key generation now requires a Power/team profile before rate-limit consumption; MCP API-key validation rejects keys for non-API tiers; settings UI disables free-plan key generation; e2e verifies the demo free-plan API tab guard | Done |
| Keep settings failures visible | Profile save failures now surface validation/API messages, successful authenticated saves refresh local profile state, and API-key generation failures render visible errors instead of console-only failures | Done |
| Remove nonfunctional launch controls | Theme and notification controls that did not change real product behavior were removed from the signed-in app shell/settings; Playwright verifies those preview-only controls are not exposed in settings | Done |
| Align Connect AI setup with paid API gate | `/settings/mcp` now shows the Power-plan API access requirement before users try to generate/connect keys; Playwright verifies the billing deep link | Done |
| Make upgrade/settings links land on the right tab | `/settings?tab=billing` now opens the billing tab, matching quota/API upgrade URLs; e2e verifies the query-param tab behavior | Done |
| Add idempotency and safer conflict handling for agent writes | `create_task` replays by `source_agent_id` + `external_ref`, migration adds `tasks_user_agent_external_ref_unique_idx`, and `npm run smoke:mcp -- --write` checks replay behavior | Implemented locally; provider verification missing |
| Add scoped API keys and agent audit trails | `supabase/migrations/003_agent_governance.sql`, settings key-scope UI, API-key rotation rate limiting, hashed key storage in `supabase/migrations/005_hashed_api_keys.sql`, scope-aware MCP setup UI, MCP scope filtering/enforcement, `agent_action_events` logging, `/api/mcp/events`, and the MCP settings activity list exist; real Supabase migration/audit-write smoke still required | Implemented locally; provider verification missing |

## Commands verified locally
- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:e2e` including logged-out task capture/edit/reload persistence/agent output, demo briefing refresh, All Tasks search/filtering, Upcoming grouping, Done clear/reload lifecycle, auth guardrails, MCP/OpenAPI/Stripe guardrails, demo CSV file import, login demo-mode entry, free-plan API-key UI gating, and settings tab deep links
- `npm audit --audit-level=moderate`
- `git diff --check`
- PR #3 GitHub Actions Web rails
- PR #3 Vercel preview

## Commands attempted but blocked
- `npm run verify:env` failed because `.env.local` is not present in this workspace. `.env.local.example` is present, but it is only the contract and cannot support provider smoke checks.

## Current completion judgment
The Monday early-access demo, local build/test rails, demo task persistence, task mutation guards, AI input/output guards, authenticated agent execution guards, import quota guards, and billing route guards are in materially better shape and are locally verified. The broader objective is not complete as a production launch because provider-backed flows, real database/auth, Stripe billing, authenticated MCP tool execution, deployment rails, and approvals remain unverified.

## Next required work
1. Configure a real Supabase project and run `npm run smoke:supabase -- --write` to verify migrations, auth, profile creation, RLS, task CRUD, and audit events.
2. Run `npm run smoke:openai`, then exercise OpenAI-backed parse, prioritization, briefing, and bounded agent execution through the app with real credentials.
3. Run `npm run smoke:stripe -- --write`, then exercise Stripe webhook delivery, plan updates, quota enforcement, and idempotency in test mode.
4. Generate scoped API keys and run authenticated MCP/ChatGPT Actions tool execution, idempotency replay, and audit-write checks against real task data with `npm run smoke:mcp -- --write`.
5. Route public copy through Quill/founder approval before external launch use.
