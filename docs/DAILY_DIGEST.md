# Daily Digest

## 2026-05-16
### Shipped
- Read all existing Markdown and text files in the repo, including `.github/pull_request_template.md`, `AGENTS.md`, the operating docs, and `public/robots.txt`.
- Updated the agent operating context to reflect the real Next.js/Supabase/OpenAI/Stripe/MCP product surfaces.
- Added `README.md` as a concise project overview for humans and LLM agents.
- Added `docs/COMPLETION_AUDIT.md` to map the active goal to concrete evidence and remaining gaps.
- Added `docs/DEPLOYMENT.md` and `npm run verify:env` for deploy/env preflight rails.
- Added `npm run smoke:openai` for real OpenAI JSON-mode provider verification.
- Added `npm run smoke:supabase` for real Supabase schema/auth/RLS/task/audit verification.
- Added `npm run smoke:mcp` for authenticated MCP/API-key verification against a real deployment.
- Exposed agent metadata fields in MCP create/update tools so agent-created tasks can carry source identifiers and external references.
- Added scoped API key permissions, scope-filtered MCP tool listings, REST/JSON-RPC scope enforcement, and an agent action audit table/migration.
- Added idempotency handling for agent task creation using `source_agent_id` plus `external_ref`, including write-smoke replay coverage.
- Opened PR #3 and verified GitHub Actions Web rails plus Vercel preview deployment.
- Updated vision, roadmap, backlog, decisions, metrics, marketing, and research docs to align with the current implementation.
- Restored stricter build rails by adding typecheck/e2e scripts and removing build-time TypeScript/ESLint ignores.
- Added deterministic local task intelligence for demo-mode parsing, prioritization, briefing, and bounded research/draft/prep outputs.
- Added Playwright smoke coverage for the logged-out core product path.
- Added Playwright smoke coverage for OpenAPI action schema, MCP/action auth failures, and action CORS headers.
- Added GitHub Actions verification for install, lint, typecheck, build, and Playwright smoke testing.
- Upgraded to Next.js 16, ESLint 9 flat config, and a PostCSS override; `npm audit --audit-level=moderate` now reports 0 vulnerabilities.
- Moved the Next middleware entrypoint to the Next 16 `proxy.ts` convention.
- Fixed mobile startup so the navigation drawer does not cover the main task screen by default.
- Tightened launch-facing copy to avoid claims about open-ended task completion, large traction, and unverified enterprise readiness.
- Added `docs/LAUNCH_PLAN.md` for the Monday early-access target and long-term AI-agent path.

### In progress
- MVP path now centers on capture, structure, prioritize, brief, and bounded execution.
- Agent-governance code exists locally; scoped key behavior, idempotency replay, and audit writes still need a real Supabase/API-key smoke.

### Blocked
- Production readiness cannot be claimed until env, migrations, auth, AI, Stripe, MCP, and deployment are verified.

### Approvals needed
- Approval is still required before public launch copy, pricing changes, production deploys, or customer-facing commitments.

### Recommended next focus
- Run the new GitHub Actions workflow on a PR/branch, then smoke test Supabase, OpenAI, Stripe, and MCP flows against real environment settings.

## 2026-04-11
### Shipped
- Added the repo-level autonomous operating layer directly to the live Nexdo repo.
- Created repo-local `AGENTS.md` with Nexdo-specific mission, ICP, priorities, and operating rules.
- Added the canonical operating doc set for vision, roadmap, backlog, decisions, metrics, marketing, research, and daily digest.

### In progress
- Aligning Nexdo’s next work around repo/deploy verification and MVP clarity.

### Blocked
- No hard blocker on the operating-layer installation itself.
- The main limitation remains that repo/build/deploy truth has not yet been fully verified in the operating layer.

### Approvals needed
- Any public-facing launch or pricing commitment beyond verified reality.

### Recommended next focus
- Verify Nexdo’s real repo/deploy state and turn that into the next bounded execution queue.
