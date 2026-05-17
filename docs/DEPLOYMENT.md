# Deployment

## Current status
PR #3 has passed the GitHub Actions Web rails workflow on recent launch-readiness heads. Vercel preview deployment passed on a recent code head, but later heads can hit Vercel account build-rate limits, so inspect current PR checks before treating the newest head as preview-deploy verified. Direct remote route smoke against protected previews is blocked by Vercel Deployment Protection until `VERCEL_AUTOMATION_BYPASS_SECRET` is supplied locally or an unprotected preview URL is used. Local `npm run verify:env` currently fails because `.env.local` is absent; only `.env.local.example` exists in this workspace. No production deploy target or production provider credentials were verified in this operating pass. Treat Nexdo as locally and CI verified, with preview-deploy evidence only on checked heads, but not production-ready until the checks below pass against the real deployment environment.

## Branch and release rails
- Use `main` as the production branch unless a deploy platform is configured differently.
- Run changes through a PR so `.github/workflows/verify.yml` can execute on a clean runner.
- Required checks before deploy: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e`, and `npm audit --audit-level=moderate`.
- Production deploys require approval.

## Local development setup
1. Install dependencies with `npm install` or `npm ci`.
2. Copy `.env.local.example` to `.env.local` only when you have real provider values.
3. For no-provider local work, leave `.env.local` absent and use the logged-out demo path. The app is expected to keep auth-dependent routes guarded and demo flows functional without Supabase/OpenAI/Stripe secrets.
4. Start the app with `npm run dev`.
5. Before pushing changes, run `npm run lint`, `npm run typecheck`, `npm run test:e2e`, `npm run build`, `npm audit --audit-level=moderate`, and `git diff --check`.

Known local behavior:
- Missing Supabase env should expose demo mode rather than a broken auth screen.
- Missing OpenAI env should use deterministic local task intelligence.
- Missing Stripe env should fail billing actions closed instead of creating checkout sessions.
- Missing MCP API keys should not block the app; MCP smoke keys are shell-only verification inputs.

## Environment preflight
Use `.env.local.example` as the local contract and `.env.production.local.example`
as the preview/production smoke template.

For local env checks, run:

```bash
npm run verify:env
```

By default the script checks `.env.local`. To check another file:

```bash
npm run verify:env -- .env.production.local
```

Required groups:
- Supabase: URL, anon key, service-role key
- OpenAI: API key; optional `OPENAI_MODEL` defaults to `gpt-4o`
- Stripe: secret key, webhook secret, publishable key, Pro price ID, Power price ID
- App: public origin without a trailing slash

The verifier only checks presence, shape, and placeholder risk. It does not prove provider connectivity.

The verifier intentionally rejects common placeholder fragments such as
`placeholder`, `your-`, `xxx`, `replace`, `example`, `todo`, and `changeme`.
Use a copy of `.env.local.example` or `.env.production.local.example` with real
values instead of editing the example files directly.

## Launch smoke bundle
Once real provider env is available, the fastest technical verification path is
the launch smoke bundle:

```bash
cp .env.production.local.example .env.production.local
npm run smoke:launch -- --env=.env.production.local --url=https://your-preview.example --technical-only
```

The bundle loads the env file into child processes, runs lint, typecheck,
build, Playwright, dependency audit, env preflight, rendered route smoke, and
the Supabase, authenticated app, OpenAI, Stripe, and MCP smoke sequence below. `--technical-only`
intentionally keeps manual gates visible: public copy approval and production
deploy approval are not implied by passing technical smokes.

Provider smokes in the launch bundle require a remote HTTPS `--url` or
`NEXT_PUBLIC_APP_URL`. Use `--allow-local-url` only when intentionally
debugging provider callbacks against a local app; do not use it as launch
evidence.

If the target URL is a Vercel preview protected by Deployment Protection, set
`VERCEL_AUTOMATION_BYPASS_SECRET` in the env file or shell before running route
or launch smokes. The route smoke sends Vercel's automation bypass headers
(`x-vercel-protection-bypass` and `x-vercel-set-bypass-cookie`) when that value
is present. Without it, the smoke fails fast on the Vercel login wall instead of
treating the preview as route-render verified.

For a final launch gate after approvals and production deploy verification:

```bash
npm run smoke:launch -- --env=.env.production.local --url=https://your-production.example --copy-approved --production-deploy-verified
```

## Production setup sequence
1. Create or select the production Supabase project.
2. Apply every migration in `supabase/migrations/` to that project.
3. Configure production environment variables in the deploy platform from `.env.production.local.example`; do not configure smoke-only `NEXDO_API_KEY` values as app runtime env.
4. Configure Stripe test-mode first, including `STRIPE_PRO_PRICE_ID`, `STRIPE_POWER_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET`.
5. Configure OpenAI with `OPENAI_API_KEY` and optional `OPENAI_MODEL`.
6. Set `NEXT_PUBLIC_APP_URL` to the public production origin with no trailing slash.
7. Run `npm run verify:env -- <env-file>` locally against an exported production env file, or verify the same variable set in the deploy platform before treating the environment as launch-ready.
8. Deploy to preview, then run the provider smoke tests below against the preview URL.
9. Only after the provider smokes and approvals pass, promote to production.

## Provider smoke tests still required
- Routes: run `npm run smoke:routes -- --url=<preview-or-production-origin>` to verify launch-facing marketing, app, auth, import, settings, MCP setup, privacy, and terms routes render at desktop and mobile widths without response failures, blank bodies, framework overlays, or console errors. For protected Vercel previews, export `VERCEL_AUTOMATION_BYPASS_SECRET` first.
- Supabase: apply migrations to a real project, create a user, verify profile creation, RLS, task CRUD, task-note CRUD and length limits, import quota enforcement, hashed API-key storage, API key scope persistence and rotation rate limits, profile column read/update grants, direct profile insert denial, direct profile content-bound denial, direct task source-spoof denial, direct task content-bound denial, task and task-note column-grant denial for server-managed fields, Stripe event record privacy/write denial, usage-event mutation denial, rate-limit bucket privacy, agent external-ref uniqueness, `agent_action_events` audit writes/privacy, quota no-op behavior, and service-role RPCs.
- Authenticated app API: run `npm run smoke:app` against the same app URL and Supabase project to verify app-cookie auth, task list/create/update/delete, task-note validation/create/readback, and seeded agent-review validation/save behavior through the deployed API routes. For protected Vercel previews, export `VERCEL_AUTOMATION_BYPASS_SECRET` first.
- OpenAI: verify parse, prioritization, briefing, and owned-task research/draft/prep execution with real credentials, server-side output persistence, quota use, and rate-limit behavior. For protected Vercel previews, export `VERCEL_AUTOMATION_BYPASS_SECRET` first.
- Stripe: verify authenticated checkout, authenticated portal, signed webhook handling, duplicate webhook idempotency, subscription tier updates/deletes, payment-failure downgrade, quota enforcement, authenticated task-create quota behavior after entitlement changes, and unknown-price behavior in test mode. For protected Vercel previews, export `VERCEL_AUTOMATION_BYPASS_SECRET` first.
- MCP/ChatGPT Actions: provision real scoped API keys or provide existing smoke keys, then run authenticated SSE endpoint discovery and list/create/update/add-note/complete/search/briefing/get-task calls against real task data, including `create_task` replay with a repeated `source_agent_id` plus `external_ref`, `complete_task` task-row trace persistence, `add_task_note` note readback, and `agent_action_events` audit rows. For protected Vercel previews, export `VERCEL_AUTOMATION_BYPASS_SECRET` first.

Read-only MCP smoke:

```bash
NEXDO_API_KEY=nxd_... npm run smoke:mcp -- --url=https://your-deploy.example
```

`NEXDO_API_KEY` and `NEXDO_READONLY_API_KEY` are smoke-only shell variables.
They do not need to be configured in Vercel or in `.env.local` for the app to
run.

Optional scoped-key smoke. Provide a key with only `tasks:read` and `briefing:read`
to verify write tools are hidden from `tools/list` and rejected with 403:

```bash
NEXDO_API_KEY=nxd_full_or_read_key NEXDO_READONLY_API_KEY=nxd_readonly... npm run smoke:mcp -- --url=https://your-deploy.example
```

Write smoke that creates and completes a disposable task:

```bash
NEXDO_API_KEY=nxd_... npm run smoke:mcp -- --url=https://your-deploy.example --write
```

Provisioned write smoke with required audit verification. Run this from a shell
that also has the target Supabase project service-role env loaded; it creates
and deletes disposable Power-plan profiles and full/read-only scoped API keys:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co SUPABASE_SERVICE_ROLE_KEY=... npm run smoke:mcp -- --url=https://your-deploy.example --provision --write --audit
```

Read-only Supabase schema smoke:

```bash
npm run smoke:supabase
```

Write Supabase smoke that creates and deletes disposable auth/task/note/audit data and verifies profile grants, profile insert denial, profile content-bound denial, task source-spoof denial, task content-bound denial, task and task-note column grants, audit privacy, Stripe event record privacy/write denial, usage-event mutation denial, rate-limit bucket privacy, uniqueness, quota, and rate limits:

```bash
npm run smoke:supabase -- --write
```

Authenticated app API smoke. Run this against a local or preview app with
matching Supabase env loaded; it creates and deletes a disposable Supabase user
and verifies app-cookie auth, authenticated task CRUD, and task-note routes:

```bash
npm run smoke:app
```

OpenAI provider smoke:

```bash
npm run smoke:openai
```

OpenAI app-route smoke. Run this against a local or preview app with matching
OpenAI and Supabase env loaded; it creates and deletes a disposable Supabase
user and verifies authenticated parse, prioritize, briefing, and
research/draft/prep execution routes:

```bash
npm run smoke:openai -- --app
```

Read-only Stripe billing smoke:

```bash
npm run smoke:stripe
```

Stripe write smoke that creates and deletes disposable test-mode billing objects:

```bash
npm run smoke:stripe -- --write
```

Stripe webhook smoke that creates disposable Stripe and Supabase test objects,
checks authenticated checkout and billing portal routes, posts signed
subscription and failed-payment events to the app webhook, checks tier changes,
checks free/pro/power quota plan-state boundaries, checks authenticated
`POST /api/tasks` quota behavior under those tiers, checks duplicate replay,
and cleans up:

```bash
npm run smoke:stripe -- --write --webhook
```

## Rollback notes
- Keep the last known-good deploy available in the deploy platform.
- If a release breaks auth, billing, or task writes, roll back before attempting live data fixes.
- Database migrations should be reversible where practical. If not reversible, document the manual recovery path before applying them to production.

## Approval boundaries
Approval is required before:
- production deploys
- public launch copy
- pricing changes
- customer-facing commitments beyond verified product truth
