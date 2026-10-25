# Model policy

The single place that maps a role, task or reviewer to a model tier (`fast`, `standard`, `strong`) and each tier to a model id per client. `pbi-pipeline.md` (Model per dispatch, fix rounds) and `issue-planning` (the `tier` of a plan item) consume it. The ids in code: `MODEL_BY_TIER` in `src/generators/agent-model-validator.ts`; `pnpm test` fails when this file drifts from it.

## Tier by attribute

Final-Verify is `standard` because a forked skill without `agent:` (as `verify-project`) runs on the caller's model on Claude Code; no `Agent` call can pin it, so it is not pinned (`docs/concepts/skill-frontmatter.md`). Checked for #610: the fork gets no `model`, so the accepted model is the caller's sonnet.

When several rows apply, the highest tier wins.

| Attribute | Tier |
|:--|:--|
| Role `issue-reader`, `explorer` | `fast` |
| Final-Verify (`verify-project`; on Claude Code the skill's `context: fork` runs on the caller's model, so no `fast` pin) | `standard` |
| Task: docs, mechanical change, `size: S` or `size: M` | `standard` |
| Task: prose only (skill, agent or reference text) | `standard` (never below) |
| Task: parser, security, concurrency, cross-package design or `size: L` | `strong` |
| Reviewer `spec` or `conventions` | `standard` |
| Reviewer `security` or `correctness` on a `size: L` task | `strong` (`standard` otherwise) |
| Role `planner` | `strong` |
| Role `review-lead`, `pr-writer`, `implementer` default, `orchestrator`, `pbi-runner` | `standard` |

A cheaper model that needs 2–3× the turns costs more: `fast` is only for roles that read or run commands, never for a task that writes code or prose. Every dispatch names its tier's model; none falls back to the caller's model.

## Escalation in the fix loop

Fix rounds of one task (counted per task, from its first blocking review; in a PBI with several tasks each task has its own counter and tier, and a blocking finding on one task never escalates another):

1. Round 1: a `CHANGES_REQUESTED` with at least one blocking finding → resume the same implementer at its tier.
2. Round 2: the second `CHANGES_REQUESTED` with a blocking finding on the same task → a fresh implementer one tier up (`fast` → `standard` → `strong`). A task already at `strong` gets no higher model: the fresh implementer runs at `strong` again with the findings and the ladder continues unchanged.
3. Round 3: still a blocking finding → resume the escalated implementer once (for a task already at `strong`: the round-2 implementer).
4. Still blocked after round 3 → gate to the user (`orchestrator-gates.md`).

Never escalate for an advisory-only round (selected MEDIUM/LOW findings without a blocking one) or for a `DONE_WITH_CONCERNS` reply; those keep the same implementer and tier and do not count as a round of this ladder. Clients without resume (Copilot subagents are stateless) start a fresh implementer at the round's tier with the findings, the context path and the report path.

## Tier to model per client

| Tier | Claude Code (`model` of the `Agent` call) | OpenCode (`provider/id`) | Copilot CLI |
|:--|:--|:--|:--|
| `fast` | `haiku` | `anthropic/claude-haiku-5-5` | `claude-haiku-5.5` |
| `standard` | `sonnet` | `anthropic/claude-sonnet-5-5` | `claude-sonnet-5.5` |
| `strong` | `opus` | `anthropic/claude-opus-5-5` | `claude-opus-5.5` |

- Claude Code sets the model per dispatch: every `Agent` call names the tier's model explicitly.
- OpenCode and Copilot take the model from the agent file and cannot override it per dispatch; a tier other than the agent file's default needs a generated variant (`apmw sanitize`: `implementer-strong`, `reviewer-strong`). Until those variants exist they run at the agent file's tier.
- Copilot CLI's main thread uses the session model (`--model`, `/model`).
