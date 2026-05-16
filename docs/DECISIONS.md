# Decisions

## 2026-05-16 - Treat Monday as verified early access, not broad launch
### Decision
Aim for a verified early-access/demo-ready product by Monday, 2026-05-18, with truthful copy, passing rails, and a clear launch-blocker list.

### Why
The app has enough product surface to demonstrate the core workflow, but production env, billing, security, and agent integrations still need end-to-end verification.

### Impact
Future agents should prioritize checks, demo reliability, and blocker removal before broad marketing or production commitments.

## 2026-05-16 - Keep demo intelligence useful without provider env
### Decision
Use deterministic local fallbacks for task parsing, prioritization, daily briefing, and bounded research/draft/prep outputs when OpenAI or Supabase is unavailable.

### Why
The logged-out demo and local development experience must show the real product shape even when provider credentials are not configured.

### Impact
The fallback path is not a replacement for provider-backed AI, but it keeps the core workflow inspectable and testable.

## 2026-05-16 - Ground agent context in the actual implementation
### Decision
Update agent-facing docs to describe Nexdo as an active Next.js/Supabase/OpenAI/Stripe product shell with task, AI, import, billing, and MCP surfaces, while marking deploy/build/env truth as still unverified.

### Why
The prior operating docs framed Nexdo mostly as a concept. The repo now contains enough concrete product code that future agents need an accurate map of what exists and what still needs verification.

### Impact
Agents should prioritize verification and hardening of the existing product surfaces over abstract repositioning. Product claims must be checked against the implementation before being treated as launch-ready.

## 2026-05-16 - Keep public promises below verified product truth
### Decision
Public copy must be audited against the real product and routed through Quill before external launch use.

### Why
The marketing page includes strong claims around AI task execution, integrations, security, and user traction. Those claims may be useful draft direction, but they should not ship as verified commitments without review.

### Impact
Marketing work can continue as draft work, but production launch copy needs approval and a product-truth check.

## 2026-04-11 - Add the autonomous operating layer to the live Nexdo repo
### Decision
Apply the canonical autonomous OS standard directly to the live Nexdo repo.

### Why
The operating system should live in the actual product repo, not only in a local control-layer folder.

### Impact
The repo now carries the canonical doc set and repo-level constitution for autonomous management.

## 2026-04-11 - Repo/deploy verification takes priority over vague product rhetoric
### Decision
The next important Nexdo step is verifying real build/deploy rails before drifting into more abstract positioning work.

### Why
The portfolio queue already marks repo/deploy verification as the next major milestone.

### Impact
Execution should prioritize reality, scaffolding, and MVP clarity over high-level productivity branding alone.
