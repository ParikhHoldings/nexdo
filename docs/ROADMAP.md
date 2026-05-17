# Roadmap

## Current verified shape
- Active Next.js 16 app code exists.
- Supabase schema/migrations and auth/data helpers exist.
- AI parsing, prioritization, briefings, and bounded agent execution code exists.
- Natural-language task parsing now carries due times through capture, authenticated task creation, and MCP-created tasks, and local fallback parsing keeps common schedule, priority, and estimate phrases out of task titles.
- Prioritization and briefing context now preserve due times, and deterministic ranking orders same-day timed tasks by due time.
- Daily briefings refresh on structured planning metadata changes and surface past due times today as overdue.
- Local deterministic fallbacks now support demo-mode parsing, prioritization, briefing, and bounded agent outputs when provider env is missing.
- The app workspace now has a real persisted dark/light appearance preference.
- The app workspace now has permission-gated local browser reminders for active tasks due today or overdue.
- Strict build rails are restored so lint and TypeScript errors block production builds.
- A Playwright smoke test covers the core logged-out demo path.
- Playwright now covers demo workspace navigation across mobile sidebar open/close, All Tasks search/filtering, Upcoming grouping, and Done task lifecycle.
- Playwright smoke tests cover OpenAPI action schema availability, MCP/action auth failures, and action CORS headers.
- `npm run smoke:routes` now verifies launch-facing routes at desktop and mobile widths against a supplied app URL.
- Playwright tests cover DB-backed MCP tool handler and API-key validation behavior through an in-memory Supabase double, including owned reads, search, briefing, create idempotency, quota ordering, mutations, audit logging, hashed-key lookup, legacy-key migration, and paid-plan gating.
- GitHub Actions verification exists for install, lint, typecheck, build, and Playwright smoke testing.
- PR #3 Web rails and Vercel preview deployment passed on the latest checked code head after the route-smoke rail.
- Dependency audit is clean after the Next.js 16, ESLint 9, and PostCSS remediation.
- `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e` with 83 tests, dependency audit, and the technical launch smoke partial passed locally on 2026-05-17.
- `docs/MVP.md` now defines the smallest trustworthy MVP path around capture, structure, prioritize, brief, bounded execution, and scoped agent task-layer access.
- Import, billing/quota, MCP, and ChatGPT Actions surfaces exist.
- File imports now preview task count, sample titles, and plan/cap warnings before tasks are added.
- Google Tasks and Microsoft To Do are usable through manual access-token imports; full OAuth is still a post-launch integration path.
- Due-today task filters, browser reminders, MCP filtering, date-only imports, and relative labels now use local calendar dates instead of UTC day strings.
- Bounded agent outputs now keep execution history plus verification status and notes in the task detail panel.
- Agent `update_task` can now maintain the core planning fields humans can edit, including due time, action type, estimate, energy level, people, and tags.
- Human task-create and task-patch routes now share `lib/task-validation.ts` so protected/server-managed fields are rejected before quota or database mutation.
- Direct browser task writes are now column-limited so agent output, source-agent metadata, ingestion intent, and completion timestamps stay server-managed; server import routes persist imported external refs/completion timestamps through the service-role path after auth/quota checks.
- The landing/signup draft now routes demo CTAs to the verified demo path and avoids treating unverified agent flows as a broad launch claim.
- Connect AI setup guidance now routes paid users without a copied key directly to the API settings tab.
- Done-page bulk delete now restores failed authenticated deletes immediately instead of hiding failed tasks until refresh.
- Production deploy state, environment completeness, and end-to-end flow status are still unverified in the operating layer.

## Current themes
1. repo and deploy verification
2. MVP hardening around task capture, prioritization, briefing, and bounded execution
3. public-copy truth audit
4. agent/API interoperability verification

## Near-term priorities
- verify install, lint, build, and local dev rails
- keep `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e` passing
- verify Supabase migrations, RLS, auth, demo-mode fallback, profile/task column grants, audit privacy, and profile/task flows
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
