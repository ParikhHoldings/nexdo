# Backlog

## Completed 2026-05-16
- read and updated the repo-level agent context and all existing Markdown/text operating files
- added a project README and Monday launch plan
- added `docs/COMPLETION_AUDIT.md` to map the active goal to evidence and remaining gaps
- added deployment rails and an environment preflight verifier
- added an authenticated MCP smoke script for real API-key verification
- exposed MCP create/update metadata for agent-created task traceability
- added scoped API key permissions, MCP scope filtering/enforcement, and an `agent_action_events` audit trail migration
- added agent write idempotency for `create_task` through `source_agent_id` plus `external_ref`
- opened PR #3 and verified GitHub Actions Web rails plus Vercel preview deployment
- enabled strict lint/typecheck behavior in production builds
- added deterministic local task intelligence fallbacks for demo/provider-missing flows
- added Playwright smoke coverage for the logged-out core product path
- added Playwright smoke coverage for OpenAPI action schema, MCP/action auth failures, and action CORS headers
- added GitHub Actions verification for install, lint, typecheck, build, and Playwright smoke testing
- upgraded to Next.js 16 and ESLint 9 flat config
- remediated the dependency audit to 0 vulnerabilities with a PostCSS override
- moved the framework request hook from `middleware.ts` to the Next 16 `proxy.ts` convention
- fixed mobile app startup so the navigation drawer no longer covers the main task screen by default
- tightened launch-facing copy away from open-ended autonomy, unverified traction, and unverified enterprise-security claims
- verified `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e` locally

## High priority
- configure and verify the real production deploy target
- verify Supabase migrations against a real project, including RLS and service-role RPCs
- smoke test auth, profile creation, task CRUD, demo-mode fallback, and app navigation
- smoke test OpenAI task parse, prioritization, daily briefing, and agent execution with real env
- smoke test Stripe checkout, portal, webhook idempotency, and plan/quota updates in test mode
- smoke test MCP JSON-RPC and ChatGPT Actions OpenAPI/API-key flow
- smoke test authenticated MCP tool execution against real task data
- smoke test MCP `create_task` idempotency replay against real task data
- smoke test scoped MCP key behavior and `agent_action_events` writes against a real Supabase project
- complete Quill/founder review of `app/(marketing)/page.tsx` before public launch
- document the minimum real MVP path around capture, structure, prioritize, brief, and bounded execution

## Medium priority
- identify the fastest revenue angle for an AI-native task manager in this portfolio context
- tighten landing/waitlist language around the clearest user promise
- clarify whether Nexdo should lead with founder/operator use case or broader team use case
- add focused tests for task validation, import normalization, quota/rate-limit helpers, and MCP tool handlers
- add unit tests for deterministic task intelligence fallbacks
- verify import routes with representative Todoist, CSV, ICS, Trello, and Things-style files
- improve OpenAPI/action response consistency where wrappers differ from MCP tool payloads
- document known local-development and production-environment setup steps

## Low priority
- explore broader feature sets before MVP truth is nailed down
- add polish/theory work that does not move execution closer
- expand unsupported OAuth imports before core import and task flows are verified

## Research / open questions
- what is the strongest differentiated workflow for Nexdo?
- what exact user segment should feel the first pull?
- what minimum product behavior would make Nexdo clearly better than a standard task manager?
- which agent-executable task types create enough trust without promising open-ended autonomy?
- should the first public wedge emphasize founder/operator planning or agent task-layer interoperability?
