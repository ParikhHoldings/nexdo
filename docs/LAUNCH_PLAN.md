# Launch Plan

## Immediate plan for Monday, 2026-05-18
The goal is not a broad public launch. The credible Monday target is a verified early-access product demo with clear rails for humans and AI agents.

`docs/MVP.md` is the working product contract for this target: capture -> structure -> prioritize -> brief -> bounded execution, plus scoped task-layer access for AI agents.

### Must ship
- A local app that passes clean install, lint, typecheck, build, dependency audit, and Playwright smoke tests. Latest full local rail passed 96 tests on 2026-05-17.
- A usable logged-out demo flow: load `/today`, inspect demo tasks, add a natural-language task, see prioritization, open an executable task, and generate a bounded agent output. Verified locally through the 2026-05-17 Playwright suite.
- Core task mutation routes now validate allowlisted fields and protect owned-task updates/deletes.
- Task detail now supports notes for launch context and handoffs, with logged-out demo persistence, authenticated owned-task note routes, and external-agent note appends through MCP/ChatGPT Actions.
- Authenticated agent execution now loads owned task records by `taskId`, rejects unsupported action types through the shared executable-action contract, saves output server-side, and checks quota-consumption failures.
- Bounded agent outputs now include execution history and user verification notes in task detail; authenticated review-note persistence still needs real Supabase verification.
- Manual and reminder tasks do not expose AI-agent run controls in the task card or detail surfaces.
- Authenticated task imports now pre-check monthly task quota, save imported tasks, then record quota for successfully inserted rows with cleanup if accounting fails.
- Google Tasks and Microsoft To Do are exposed as manual access-token imports for early verification; full OAuth connection remains a post-launch workflow.
- Public AI-agent surfaces expose a valid OpenAPI action contract and enforce bearer auth before tool execution. Smoke-tested locally through the 2026-05-17 Playwright suite.
- Agent-side cancelled tasks remain visible in All Tasks through an explicit `cancelled` status filter and can be restored from task detail.
- API key rotation now uses the shared rate-limit rail and verifies hashed-key persistence before revealing a new scoped MCP/API key.
- MCP/API keys now have local scope modeling, scope-aware setup UI, scope-filtered tool listings, scope enforcement, and an agent action audit table. Real Supabase/API-key verification is still required before treating this as production-ready.
- MCP smoke can now verify OpenAPI availability, initialized-notification handshake, authenticated SSE endpoint discovery, JSON-RPC list/search/briefing/get/update/add-note/complete execution, ChatGPT Actions list/search/add-note response shape, read-only scoped key denial, provisioned disposable scoped keys, write idempotency, completed-task trace persistence, and required audit rows when run with `--provision --write --audit`.
- Route smoke can now verify launch-facing marketing, app, auth, import, settings, MCP setup, privacy, and terms routes at desktop and mobile widths against a preview/production URL.
- Authenticated app smoke can now verify deployed app-cookie auth, task list/create/update/delete, and task-note validation/create/readback against a real Supabase-backed app session.
- The MCP settings page now exposes recent agent activity from the audit table when a user is authenticated.
- Agent task creation now has local idempotency handling through `source_agent_id` plus `external_ref`; real Supabase/API-key replay verification is still required.
- PR #3 Web rails passed on 2026-05-17 after the Stripe app billing smoke hardening commit (`8bad78f`).
- GitHub Actions Web rails include install, lint, typecheck, build, dependency audit, and Playwright smoke testing so CI matches the documented launch/deploy checklist.
- Vercel preview deployment and Vercel Preview Comments passed on the same checked head, but later pushes can hit Vercel account build-rate limits.
- Remote route smoke against protected previews needs `VERCEL_AUTOMATION_BYPASS_SECRET` or an unprotected preview URL because those previews are behind Vercel Deployment Protection.
- Strict build rails: TypeScript and lint failures block `npm run build`. Verified locally on 2026-05-17.
- OpenAI provider verification now has a repeatable smoke script, `npm run smoke:openai`; it rejects placeholder keys and verifies parse, prioritization, briefing, research, draft, and prep output shapes. With `--app`, it also creates a disposable Supabase user and verifies authenticated app parse, prioritize, briefing, and research/draft/prep execution routes. It still needs to be run with real OpenAI, Supabase, and target app env.
- App OpenAI helpers now use the same optional `OPENAI_MODEL` default as the smoke script and fall back locally for placeholder keys.
- Stripe provider verification now has a repeatable smoke script, `npm run smoke:stripe`; with `--write --webhook` it can post signed subscription webhooks, verify authenticated checkout and billing portal routes, verify unknown-price fail-closed behavior, verify free/pro/power tier transitions, verify quota plan-state boundaries, exercise authenticated `POST /api/tasks` quota behavior under those tiers, and verify duplicate-event idempotency against disposable test data. It still needs to be run with test-mode keys against the target app and Supabase env.
- Stripe checkout now accepts only server-known `pro` and `power` plans, derives price IDs from env, requires billing profile persistence, and skips unknown webhook price IDs instead of granting paid access.
- Pricing UI now shows only monthly prices because annual Stripe prices are not configured.
- Supabase provider verification now has a repeatable smoke script, `npm run smoke:supabase`; it still needs to be run with real credentials after migrations are applied.
- Authenticated app-route verification now has a repeatable smoke script, `npm run smoke:app`, including task CRUD, task notes, and agent-review save behavior; it still needs to be run with real Supabase credentials against the target app URL.
- Supabase migrations now include quota cleanup so usage read probes reset monthly counters without writing zero-quantity audit events.
- Supabase migrations now column-limit direct browser task inserts/updates so agent output, source-agent metadata, ingestion intent, and completion timestamps stay server-managed; authenticated imports use service-role persistence after auth/quota checks to preserve imported completion timestamps and external refs.
- Truthful public copy that describes bounded AI assistance instead of open-ended autonomous task completion. Draft tightened on 2026-05-16; still needs Quill/founder approval before external use.
- Updated docs that tell future agents what exists, what is verified, and what is still blocked.

### Must verify before external users
- Supabase migrations, auth, profile creation, RLS, profile/task column grants, task CRUD, audit privacy, and agent external-ref uniqueness against a real project.
- Authenticated app API task CRUD and task-note routes against a real Supabase-backed app session.
- Rendered front-end routes against the real preview/production origin with `npm run smoke:routes -- --url=<origin>`.
- OpenAI-backed parse, prioritize, briefing, and research/draft/prep execution with a real API key.
- Stripe checkout, portal, webhook, plan limits, and quota behavior in test mode.
- MCP JSON-RPC, action wrappers, OpenAPI output, and API-key authentication.
- Authenticated MCP tool execution against real task data.
- Deployment target, env variables, domain, rollback path, and preview/production split.

### Launch blockers
- Production env is not verified in this operating pass.
- Public-facing copy still requires Quill review and founder approval before external launch use.
- Pricing and paid plan commitments require approval and Stripe test-mode verification.

## Human-user product path
1. Capture: make natural-language task capture reliable, fast, and explainable.
2. Structure: preserve due date, priority, people, tags, effort, energy, and context.
3. Prioritize: rank the day with a visible reason for each recommendation.
4. Brief: generate a concise daily view of priorities, overdue work, quick wins, and people waiting.
5. Execute bounded work: support useful research, draft, and prep outputs with clear review expectations.
6. Trust: deepen edit history, verification notes, and failure states before increasing autonomy.

## AI-agent product path
1. Stabilize the API-key based task layer around list, create, update, add notes, complete, search, get, and brief.
2. Make agent-created, agent-updated, agent-noted, and agent-completed task mutations distinguishable with `source_agent_id`, `external_ref`, `ingestion_intent`, and `agent_metadata`.
3. Verify idempotency, direct browser column denial, and safer conflict handling for agent writes against a real Supabase project.
4. Verify scoped API keys and least-privilege permissions against a real Supabase project.
5. Verify audit trails for agent actions with real MCP/API-key execution.
6. Expand from task access to controlled execution requests only after the bounded human flow is trusted.

## Long-term direction
Nexdo should become the coordination layer where humans define intent and AI agents can safely inspect, prioritize, and advance work. The long-term product should stay anchored in observable behavior: structured context, explainable priorities, bounded execution, reviewable outputs, and agent-safe APIs.
