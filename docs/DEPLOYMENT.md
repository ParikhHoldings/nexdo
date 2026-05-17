# Deployment

## Current status
PR #3 passed the GitHub Actions Web rails workflow after the workflow action-runtime update, and Vercel deployments completed on 2026-05-16 and 2026-05-17. Repeated PR pushes have intermittently hit Vercel account build-rate limits, so inspect the current PR checks before treating preview deploy as current-green. Local `npm run verify:env` currently fails because `.env.local` is absent; only `.env.local.example` exists in this workspace. No production deploy target or production provider credentials were verified in this operating pass. Treat Nexdo as locally, CI, and preview-deploy verified but not production-ready until the checks below pass against the real deployment environment.

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
Use `.env.local.example` as the contract and run:

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
Use a copy of `.env.local.example` with real values instead of editing the
example file directly.

## Launch smoke bundle
Once real provider env is available, the fastest technical verification path is
the launch smoke bundle:

```bash
npm run smoke:launch -- --env=.env.production.local --url=https://your-preview.example --technical-only
```

The bundle loads the env file into child processes, runs lint, typecheck,
build, Playwright, dependency audit, env preflight, and the Supabase, OpenAI,
Stripe, and MCP smoke sequence below. `--technical-only` intentionally keeps
manual gates visible: public copy approval and production deploy approval are
not implied by passing technical smokes.

For a final launch gate after approvals and production deploy verification:

```bash
npm run smoke:launch -- --env=.env.production.local --url=https://your-production.example --copy-approved --production-deploy-verified
```

## Production setup sequence
1. Create or select the production Supabase project.
2. Apply every migration in `supabase/migrations/` to that project.
3. Configure production environment variables in the deploy platform from `.env.local.example`; do not configure smoke-only `NEXDO_API_KEY` values as app runtime env.
4. Configure Stripe test-mode first, including `STRIPE_PRO_PRICE_ID`, `STRIPE_POWER_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET`.
5. Configure OpenAI with `OPENAI_API_KEY` and optional `OPENAI_MODEL`.
6. Set `NEXT_PUBLIC_APP_URL` to the public production origin with no trailing slash.
7. Run `npm run verify:env -- <env-file>` locally against an exported production env file, or verify the same variable set in the deploy platform before treating the environment as launch-ready.
8. Deploy to preview, then run the provider smoke tests below against the preview URL.
9. Only after the provider smokes and approvals pass, promote to production.

## Provider smoke tests still required
- Supabase: apply migrations to a real project, create a user, verify profile creation, RLS, task CRUD, import quota enforcement, hashed API-key storage, API key scope persistence and rotation rate limits, profile column read/update grants, direct task column-grant denial for server-managed fields, agent external-ref uniqueness, `agent_action_events` audit writes/privacy, quota no-op behavior, and service-role RPCs.
- OpenAI: verify parse, prioritization, briefing, and owned-task research/draft/prep execution with real credentials, server-side output persistence, quota use, and rate-limit behavior.
- Stripe: verify checkout, portal, signed webhook handling, duplicate webhook idempotency, subscription tier updates/deletes, quota enforcement, authenticated task-create quota behavior after entitlement changes, and unknown-price behavior in test mode.
- MCP/ChatGPT Actions: provision real scoped API keys or provide existing smoke keys, then run authenticated list/create/update/complete/search/briefing/get-task calls against real task data, including `create_task` replay with a repeated `source_agent_id` plus `external_ref` and `agent_action_events` audit rows.

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

Write Supabase smoke that creates and deletes disposable auth/task/audit data and verifies profile grants, task column grants, audit privacy, uniqueness, quota, and rate limits:

```bash
npm run smoke:supabase -- --write
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
posts signed subscription events to the app webhook, checks tier changes,
checks free/pro/power quota plan-state boundaries, checks authenticated
`POST /api/tasks` quota behavior under those tiers, checks duplicate replay, and
cleans up:

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
