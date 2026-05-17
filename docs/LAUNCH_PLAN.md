# Launch Plan

## Immediate plan for Monday, 2026-05-18
The goal is not a broad public launch. The credible Monday target is a verified early-access product demo with clear rails for humans and AI agents.

`docs/MVP.md` is the working product contract for this target: capture -> structure -> prioritize -> brief -> bounded execution, plus scoped task-layer access for AI agents.

### Must ship
- A local app that passes clean install, lint, typecheck, build, and Playwright smoke tests. Verified locally on 2026-05-16.
- A usable logged-out demo flow: load `/today`, inspect demo tasks, add a natural-language task, see prioritization, open an executable task, and generate a bounded agent output. Verified locally on 2026-05-16.
- Core task mutation routes now validate allowlisted fields and protect owned-task updates/deletes.
- Authenticated agent execution now loads owned task records by `taskId`, rejects unsupported action types, saves output server-side, and checks quota-consumption failures.
- Bounded agent outputs now include execution history and user verification notes in task detail; authenticated review-note persistence still needs real Supabase verification.
- Authenticated task imports now consume monthly task quota in batch before saving imported tasks.
- Public AI-agent surfaces expose a valid OpenAPI action contract and enforce bearer auth before tool execution. Smoke-tested locally on 2026-05-16.
- API key rotation now uses the shared rate-limit rail before issuing a new scoped MCP/API key.
- MCP/API keys now have local scope modeling, scope-aware setup UI, scope-filtered tool listings, scope enforcement, and an agent action audit table. Real Supabase/API-key verification is still required before treating this as production-ready.
- MCP smoke can now verify read-only scoped keys hide and reject write tools when `NEXDO_READONLY_API_KEY` is provided.
- The MCP settings page now exposes recent agent activity from the audit table when a user is authenticated.
- Agent task creation now has local idempotency handling through `source_agent_id` plus `external_ref`; real Supabase/API-key replay verification is still required.
- PR #3 Web rails passed in GitHub Actions and the Vercel preview deployment completed on 2026-05-16.
- Strict build rails: TypeScript and lint failures block `npm run build`. Verified locally on 2026-05-16.
- OpenAI provider verification now has a repeatable smoke script, `npm run smoke:openai`; it still needs to be run with a real key and followed by authenticated app-route verification.
- App OpenAI helpers now use the same optional `OPENAI_MODEL` default as the smoke script and fall back locally for placeholder keys.
- Stripe provider verification now has a repeatable smoke script, `npm run smoke:stripe`; it still needs to be run with test-mode keys and followed by webhook/quota verification.
- Stripe checkout now accepts only server-known `pro` and `power` plans, derives price IDs from env, and skips unknown webhook price IDs instead of granting paid access.
- Pricing UI now shows only monthly prices because annual Stripe prices are not configured.
- Supabase provider verification now has a repeatable smoke script, `npm run smoke:supabase`; it still needs to be run with real credentials after migrations are applied.
- Supabase migrations now include quota cleanup so usage read probes reset monthly counters without writing zero-quantity audit events.
- Truthful public copy that describes bounded AI assistance instead of open-ended autonomous task completion. Draft tightened on 2026-05-16; still needs Quill/founder approval before external use.
- Updated docs that tell future agents what exists, what is verified, and what is still blocked.

### Must verify before external users
- Supabase migrations, auth, profile creation, RLS, and task CRUD against a real project.
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
1. Stabilize the API-key based task layer around list, create, update, complete, search, and brief.
2. Make agent-created tasks distinguishable with `source_agent_id`, `external_ref`, `ingestion_intent`, and `agent_metadata`.
3. Verify idempotency and safer conflict handling for agent writes against a real Supabase project.
4. Verify scoped API keys and least-privilege permissions against a real Supabase project.
5. Verify audit trails for agent actions with real MCP/API-key execution.
6. Expand from task access to controlled execution requests only after the bounded human flow is trusted.

## Long-term direction
Nexdo should become the coordination layer where humans define intent and AI agents can safely inspect, prioritize, and advance work. The long-term product should stay anchored in observable behavior: structured context, explainable priorities, bounded execution, reviewable outputs, and agent-safe APIs.
