# Deployment

## Current status
PR #3 passed the GitHub Actions Web rails workflow and completed a Vercel preview deployment on 2026-05-16. No production deploy target or production provider credentials were verified in this operating pass. Treat Nexdo as preview-verified, not production-ready, until the checks below pass against the real deployment environment.

## Branch and release rails
- Use `main` as the production branch unless a deploy platform is configured differently.
- Run changes through a PR so `.github/workflows/verify.yml` can execute on a clean runner.
- Required checks before deploy: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e`, and `npm audit --audit-level=moderate`.
- Production deploys require approval.

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
- OpenAI: API key
- Stripe: secret key, webhook secret, publishable key, Pro price ID, Power price ID
- App: public origin without a trailing slash

The verifier only checks presence, shape, and placeholder risk. It does not prove provider connectivity.

## Provider smoke tests still required
- Supabase: apply migrations to a real project, create a user, verify profile creation, RLS, task CRUD, API key scope persistence, `agent_action_events` audit writes, and service-role RPCs.
- OpenAI: verify parse, prioritization, briefing, and research/draft/prep execution with real credentials and rate-limit behavior.
- Stripe: verify checkout, portal, webhook signature handling, idempotency, subscription tier updates, quota enforcement, and unknown-price behavior in test mode.
- MCP/ChatGPT Actions: generate real scoped API keys and run authenticated list/create/update/complete/search/briefing/get-task calls against real task data, including `create_task` replay with a repeated `source_agent_id` plus `external_ref`.

Read-only MCP smoke:

```bash
NEXDO_API_KEY=nxd_... npm run smoke:mcp -- --url=https://your-deploy.example
```

Write smoke that creates and completes a disposable task:

```bash
NEXDO_API_KEY=nxd_... npm run smoke:mcp -- --url=https://your-deploy.example --write
```

Read-only Supabase schema smoke:

```bash
npm run smoke:supabase
```

Write Supabase smoke that creates and deletes a disposable auth user, task, and audit event:

```bash
npm run smoke:supabase -- --write
```

OpenAI provider smoke:

```bash
npm run smoke:openai
```

Read-only Stripe billing smoke:

```bash
npm run smoke:stripe
```

Stripe write smoke that creates and deletes disposable test-mode billing objects:

```bash
npm run smoke:stripe -- --write
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
