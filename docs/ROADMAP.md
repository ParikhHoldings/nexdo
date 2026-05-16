# Roadmap

## Current verified shape
- Active Next.js 16 app code exists.
- Supabase schema/migrations and auth/data helpers exist.
- AI parsing, prioritization, briefings, and bounded agent execution code exists.
- Local deterministic fallbacks now support demo-mode parsing, prioritization, briefing, and bounded agent outputs when provider env is missing.
- Strict build rails are restored so lint and TypeScript errors block production builds.
- A Playwright smoke test covers the core logged-out demo path.
- Playwright now covers demo workspace navigation across All Tasks search/filtering, Upcoming grouping, and Done task lifecycle.
- Playwright smoke tests cover OpenAPI action schema availability, MCP/action auth failures, and action CORS headers.
- Playwright tests cover DB-backed MCP tool handler behavior through an in-memory Supabase double, including owned reads, search, briefing, create idempotency, quota ordering, mutations, and audit logging.
- GitHub Actions verification exists for install, lint, typecheck, build, and Playwright smoke testing.
- PR #3 Web rails passed in GitHub Actions, and the Vercel preview deployment completed.
- Dependency audit is clean after the Next.js 16, ESLint 9, and PostCSS remediation.
- `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e` passed locally on 2026-05-16.
- `docs/MVP.md` now defines the smallest trustworthy MVP path around capture, structure, prioritize, brief, bounded execution, and scoped agent task-layer access.
- Import, billing/quota, MCP, and ChatGPT Actions surfaces exist.
- Production deploy state, environment completeness, and end-to-end flow status are still unverified in the operating layer.

## Current themes
1. repo and deploy verification
2. MVP hardening around task capture, prioritization, briefing, and bounded execution
3. public-copy truth audit
4. agent/API interoperability verification

## Near-term priorities
- verify install, lint, build, and local dev rails
- keep `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e` passing
- verify Supabase migrations, RLS, auth, demo-mode fallback, and profile/task flows
- verify OpenAI parse/prioritize/briefing/agent execution behavior with real env
- verify Stripe checkout/portal/webhook behavior in test mode before any pricing commitment
- verify MCP and ChatGPT Actions against the real API key flow
- audit marketing page claims and route public copy through Quill before external use
- keep `docs/MVP.md` aligned with verified product truth as core behavior changes

## Next major milestones
- repo state verified against portfolio standard
- deploy target, branch rails, env requirements, and rollback notes documented
- Supabase migration and seed/demo expectations documented
- MVP build sequence documented around capture -> structure -> prioritize -> brief -> execute bounded work
- first real execution sprint identified with smoke tests and launch blockers

## Risks / dependencies
- vague positioning could outrun implementation clarity
- unverified repo/deploy state could hide production blockers
- public marketing copy currently risks overclaiming if not reviewed against product truth
- AI and agent features depend on environment, rate limits, quotas, and prompt quality
- Stripe and Supabase production behavior must be verified before paid-user promises
- future framework upgrades need focused verification because Next.js 16 changed lint and proxy conventions
- too much abstraction can slow revenue-oriented execution
