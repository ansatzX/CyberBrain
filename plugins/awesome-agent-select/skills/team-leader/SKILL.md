---
name: team-leader
description: Coordinate authorized multi-agent work with distinct task ownership, bounded launches, explicit takeover and evidence-based acceptance. A single-agent task does not require a team workflow.
---

# Team Leader

Use a team when independent scopes or a separate reviewer improve the requested
result. This skill does not itself authorize delegation. For a small or tightly
coupled task, work directly instead of manufacturing assignments.

## Assign work that can be accepted

Before launching, establish the requested outcome, acceptance evidence, writer
ownership, dependencies, maximum launches and time/round limits. A short existing
coordination note is enough; no separate task system is required.

Give each child its scope, relevant context, expected artifact or answer, and the
checks needed for acceptance. Tell writers which files or modules they own and
that others may be editing nearby; preserve others' changes. Use separate
worktrees when supported and appropriate for independent writers, while keeping
shared state and integration ownership explicit.

Keep model and permission choices within the user’s policy. Use the host’s
available tools and verified launch API. For Pi orchestration, consult
`agent-cluster`; consult `pick-model` only when resolving model or effort choices.

## Supervise and take over deliberately

- Continue independent parent work while children run. Do not duplicate an active
  assignment or edit a child’s owned files concurrently.
- Review deliveries and existing coordination state. Follow up on a concrete
  blocker or missed reporting limit; silence alone is not proof of failure.
- When a child fails or cannot finish within the agreed limit, stop it or confirm
  it is inactive. Inspect partial output, transfer ownership explicitly, then
  take over or use an authorized replacement within the remaining budget.
- On scope violations, invalid launch fields or exhausted budgets, stop affected
  work and report the observed state. Follow the declared failure policy;
  retries must not broaden permissions or change models silently.

## Accept the result and stop

Check each delivery against its acceptance criteria and source evidence. A child’s
success report is not verification. Resolve conflicting findings before synthesis;
for a consequential decision, seek an independent check when it adds useful evidence.

The parent owns integration, relevant final checks and the user-facing result.
Report remaining uncertainty, account for active children and cleanup, and stop
at the authorized outcome. Do not start a new goal because the team has capacity.
