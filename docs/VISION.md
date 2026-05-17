# Vision

## What this product is
Nexdo is an AI-native task manager built to help users move from task capture to execution with more context, prioritization, and momentum than traditional task tools.

## Who it serves
- founders and operators managing many moving priorities
- users who want more proactive task management, not just static lists
- people attracted to AI-native workflow support but frustrated by vague productivity software claims

## Core promise
Nexdo helps users organize, prioritize, and execute meaningful work by turning plain-language task capture into structured context that AI and agents can use.

## Current product truth
- Next.js app shell exists for marketing, auth, task workspace, imports, settings, billing, and MCP setup.
- Supabase schema exists for profiles, tasks, notes, briefings, usage events, rate limits, and Stripe event idempotency.
- OpenAI-backed task parsing, prioritization, daily briefing, and agent execution helpers exist.
- Deterministic fallback intelligence exists for demo/provider-missing task parsing, prioritization, briefing, and bounded execution outputs.
- Agent execution is currently bounded to research, draft, and prep task types.
- Bounded agent outputs now support execution history plus user verification status and notes.
- MCP and ChatGPT Actions surfaces exist for external agents to interact with tasks through an API key.
- OpenAPI action schema, MCP/action unauthenticated guardrails, and action CORS headers are smoke-tested locally.
- Demo mode exists so the app can be explored without a configured Supabase session.
- Local clean install, lint, typecheck, build, dependency audit, full Playwright checks, and the technical launch smoke partial passed on 2026-05-17.

## Current constraints
- deploy target, migrations, env, provider-backed AI, Stripe, MCP, and production flows still need explicit verification
- production dependency audit is currently clean, but dependency upgrades should stay on the verification checklist
- product promise must stay grounded in what can actually be built and proven
- AI-native positioning must emphasize concrete behavior: parsing, prioritization, briefings, context, and bounded execution
- marketing claims must be audited before public use, especially claims about user volume, security, integrations, and "doing" tasks

## Non-goals
- becoming a generic to-do list app with AI slapped on top
- relying on abstract productivity language without clear differentiated workflows
- treating branding as a substitute for verified execution capability
- promising autonomous execution beyond what the current agent routes can perform

## What success looks like
- Nexdo has a verified repo/deploy path
- MVP scope is clear, narrow, and execution-ready
- product promise is concrete enough to build, test, and sell honestly
- early users can capture tasks, get useful prioritization/briefing help, and connect agents through a reliable task layer
- Nexdo becomes an active product with verified rails, not a strong concept with unverified claims
