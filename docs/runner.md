# The runner (retired)

apm-hub contains no pipeline of its own. The dromos runner and its launcher skill `/orchestrator` are removed (decision 004: dromos is archived at v0.4.0; the bus, Attention API and gates continue in [GravionLabs/keryx](https://github.com/GravionLabs/keryx)).

Delivery runs through the skill `deliver` (package `delivery`), the same on Claude Code, OpenCode and Copilot CLI: `/deliver <nr> [<nr> …] [--milestone <name>]` takes the open PBIs of a PBI, Feature or Epic in dependency order; per PBI a subagent implements with `implementation`, a subagent reviews with `code-review`, at most 2 fix rounds follow, then the PR into `release/next`, the wait for the required checks, the squash merge and the closed issue. State lives in GitHub only, so `/deliver <nr>` resumes a stopped run. A missing breakdown is planned with `planner` and `grill-me` in the same session.

Interactive by default: an unclear criterion, extra scope or a blocker asks you in the chat. `/deliver <nr> --unattended` (`claude -p`, `opencode run`, `copilot -p`) comments on the issue instead, labels it `needs-decision` and continues with the next independent PBI.

The hard gate is a GitHub ruleset on `release/next` (required checks, no bypass): a red check blocks the merge whatever the session does. `deliver` warns at the start when the repository has none. The Claude Code workflow `workflow.js` of the previous version stays frozen next to the skill until the retro (#865).

## Parallel runs

Several sessions can run `/deliver` at the same time, one worktree per session (`claude --worktree`; `git worktree add` for OpenCode and Copilot CLI) and on independent issues. Each session claims the PBI it announces by assigning it (`gh issue edit <nr> --add-assignee @me`) and releases the claim when the PBI is merged, blocked or paused. Selection through a Feature or Epic skips a PBI that is assigned and whose branch was pushed within the last hour; a stale claim (older branch, no open PR activity) is taken over. `/deliver <nr>` on the PBI itself continues it regardless of the claim. Details: `references/claim.md` of the `deliver` skill.

Without `/deliver` you work interactively, see [Working mode](working-mode.md).

## Migrating

| Before                         | Now                                                      |
| :----------------------------- | :------------------------------------------------------- |
| `/orchestrator run <nr>`       | `/deliver <nr>`                                          |
| `/orchestrator plan <nr>`      | `planner` (`Plan issue #<nr>.`)                          |
| `/orchestrator status <nr>`    | the sub-issues and PRs on GitHub                         |
| `.dromos/config.json`          | delete it; project settings are in `.agents/config.json` |
| `npm i -g @gravionlabs/dromos` | `npm uninstall -g @gravionlabs/dromos`                   |

Models of the `/deliver` subagents (where the harness takes one per call) are set with `deliver.roles` in `.agents/config.json`, see the `deliver` skill (`references/roles.md`).
