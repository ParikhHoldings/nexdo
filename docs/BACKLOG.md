# Backlog

## Completed 2026-05-16
- read and updated the repo-level agent context and all existing Markdown/text operating files
- added a project README and Monday launch plan
- added `docs/COMPLETION_AUDIT.md` to map the active goal to evidence and remaining gaps
- added deployment rails and an environment preflight verifier
- made Supabase client, server, middleware, and login demo-mode checks reject placeholder anon/service keys, not only placeholder URLs
- added a Supabase provider smoke script for schema, auth/profile trigger, RLS task CRUD, public isolation, agent audit verification, quota increments, quota no-op behavior, and rate-limit allow/block behavior
- added an OpenAI provider smoke script for JSON-mode parse, prioritization, briefing, and prep execution checks
- aligned app OpenAI helpers with the `OPENAI_MODEL` smoke/env contract and placeholder-key fallback behavior
- added a Stripe provider smoke script for account, price, Checkout, and Customer Portal configuration checks
- added an authenticated MCP smoke script for real API-key verification
- expanded MCP smoke coverage to verify read-only scoped API keys hide and deny write tools when `NEXDO_READONLY_API_KEY` is provided
- exposed MCP create/update metadata for agent-created task traceability
- added bounded MCP tool input validation and made MCP `create_task` consume task-create quota
- added scoped API key permissions, MCP scope filtering/enforcement, and an `agent_action_events` audit trail migration
- gated API-key generation and MCP API-key validation to Power/team profiles so API access matches pricing truth
- wired settings tab query parameters so upgrade links such as `/settings?tab=billing` open the intended billing tab
- pointed Stripe checkout and portal return URLs at the billing settings tab
- rate-limited API key rotation for scoped MCP/API keys
- moved generated MCP/API keys to hashed storage with one-time reveal, key hints, and legacy raw-key migration fallback
- narrowed browser-visible profile columns and direct profile self-updates so authenticated clients cannot read key hashes/Stripe IDs or self-change billing, quota, Stripe, or API-key state
- made the MCP settings tool list reflect the current API key scopes
- added an MCP settings activity list backed by `/api/mcp/events`
- added agent write idempotency for `create_task` through `source_agent_id` plus `external_ref`
- opened PR #3 and verified GitHub Actions Web rails plus Vercel preview deployment
- enabled strict lint/typecheck behavior in production builds
- hardened profile updates with allowlisted timezone/work-type values and name length normalization
- added deterministic local task intelligence fallbacks for demo/provider-missing flows
- refreshed logged-out daily briefings from local demo task state after task capture/import
- persisted logged-out demo task changes to localStorage so added/imported/edited/completed/deleted demo tasks survive reloads
- added client-side demo file import parsing for CSV, JSON, and ICS so logged-out visitors can exercise imports without weakening authenticated API import guards
- moved AI route body validation before rate-limit consumption for parse, prioritize, and briefing requests
- sanitized prioritization and briefing task arrays before rate-limit consumption and AI provider/fallback execution
- validated and bounded OpenAI JSON responses before parsed tasks, prioritization, briefings, or agent outputs are returned or saved
- hardened task mutation routes with allowlisted PATCH fields and owned-delete 404 handling
- made task detail editing functional for title, context, due date, priority, action type, estimate, people, and tags
- hardened authenticated agent execution so the server runs only owned executable task records and persists output
- hardened agent execution quota ordering so output is not saved or returned if usage recording fails
- fixed optimistic task updates so agent-output edits do not accidentally clear `completed_at`
- enforced monthly task quotas across CSV, JSON, ICS, Todoist, Google Tasks, and Microsoft To Do imports
- moved CSV, JSON, and ICS import auth/config checks before file or body parsing
- made `agent_output` server-managed so generic task PATCH requests cannot spoof agent results
- added a quota cleanup migration so usage read probes do not write zero-quantity audit events
- removed the unbacked annual pricing toggle until annual Stripe prices exist
- hardened Stripe checkout so clients can only request server-known `pro` or `power` plans and cannot override price IDs
- hardened Stripe webhooks so unknown price IDs do not grant paid-tier access by default
- added Playwright smoke coverage for the logged-out core product path
- added Playwright smoke coverage for OpenAPI action schema, MCP/action auth failures, and action CORS headers
- added GitHub Actions verification for install, lint, typecheck, build, and Playwright smoke testing
- hardened authenticated task creation with explicit validation/normalization before quota consumption
- upgraded to Next.js 16 and ESLint 9 flat config
- remediated the dependency audit to 0 vulnerabilities with a PostCSS override
- moved the framework request hook from `middleware.ts` to the Next 16 `proxy.ts` convention
- fixed mobile app startup so the navigation drawer no longer covers the main task screen by default
- tightened launch-facing copy away from open-ended autonomy, unverified traction, and unverified enterprise-security claims
- verified `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e` locally

## High priority
- configure and verify the real production deploy target
- run `npm run smoke:supabase -- --write` against a real Supabase project after applying migrations, including hashed API-key columns and profile column read/update grants
- run `npm run smoke:openai` with a real OpenAI key, then verify the authenticated in-app AI routes
- run `npm run smoke:stripe -- --write` with Stripe test-mode keys, then verify webhook events and quota updates
- smoke test auth, profile creation, task CRUD, demo-mode fallback, and app navigation
- smoke test OpenAI task parse, prioritization, daily briefing, and agent execution with real env
- smoke test authenticated agent execution against an owned Supabase task after provider env is configured
- smoke test Stripe checkout, portal, webhook idempotency, and plan/quota updates in test mode
- add webhook-level regression coverage for unknown Stripe price IDs once route-handler tests are in place
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
- verify import quota behavior against a real Supabase profile near the monthly task limit
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
