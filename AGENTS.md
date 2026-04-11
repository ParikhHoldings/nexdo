# AGENTS.md

## Mission
This repository supports Nexdo.

The mission is to turn Nexdo into a credible AI-native task manager with a clear product promise, verified build rails, and a path to autonomous product execution.

## Product context
- ICP: founders, operators, and teams who want a task manager that is more execution-oriented and AI-native than traditional checklist tools
- Core promise: Nexdo helps users move from tasks to forward motion by making planning, prioritization, and execution smarter and more proactive
- Current priorities:
  1. verify and standardize repo/deploy/build rails
  2. tighten the core product promise and MVP path
  3. create a practical path from concept to real active product execution

## General operating rules
- Operate proactively.
- Convert founder input into roadmap updates, tasks, and execution.
- Prefer momentum through small, bounded tasks.
- Prefer reversible changes over broad rewrites.
- Keep documentation aligned with reality.
- Create follow-up tasks whenever work is deferred or partially completed.
- Minimize unnecessary confirmations.
- Do not let vague AI-native positioning substitute for concrete product behavior.

## Commands
- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Public-facing copy: route through Quill before real external use

## Definition of done
A task is done only when:
- the implementation or artifact is complete
- relevant checks pass
- docs are updated if reality changed
- PR or summary explains what changed and why
- follow-up tasks are created for anything deferred

## Approval boundaries
Require approval before:
- public launch copy goes live
- pricing changes
- public posting or sending outreach
- production deploys
- customer-facing commitments beyond verified product truth

## Safe autonomous actions
The agent may do these without asking:
- create or update internal docs
- create and reprioritize backlog items
- perform research
- draft product and marketing assets
- tighten MVP framing and repo/deploy requirements
- improve internal planning and execution scaffolding
- fix low-risk bugs
- add tests
- open PRs

## Review checklist
For each meaningful change, verify:
- usefulness to the real product path
- clarity of product promise
- docs updated if needed
- overpromising risk avoided
- roadmap remains grounded in verified reality

## Documentation rules
Maintain these files as part of the operating layer:
- docs/VISION.md
- docs/ROADMAP.md
- docs/BACKLOG.md
- docs/DECISIONS.md
- docs/METRICS.md
- docs/MARKETING.md
- docs/RESEARCH.md
- docs/DAILY_DIGEST.md

## Daily digest format
Provide a concise digest with:
- shipped
- in progress
- blocked
- approvals needed
- recommended next focus

## Priority order
When choosing work, generally prioritize:
1. repo/deploy verification and active-product rails
2. revenue-enabling MVP clarity
3. marketing/distribution leverage
4. product hardening path
5. documentation cleanup

## Execution style
- Do not wait passively if safe work exists.
- Do not endlessly plan without shipping.
- Break large goals into smaller bounded tasks.
- Make Nexdo more real each cycle.
