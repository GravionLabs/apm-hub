# The runner (retired)

apm-hub contains no pipeline of its own. The dromos runner and its launcher skill `/orchestrator` are removed (decision 004: dromos is archived at v0.4.0; the bus, Attention API and gates continue in [GravionLabs/keryx](https://github.com/GravionLabs/keryx)).

Delivery runs as a Claude Code workflow: `/deliver <nr>` (skill `deliver`, package `delivery`) plans a PBI, Feature or Epic, implements each open and unblocked PBI in a worktree, reviews it, opens the PR into `release/next`, waits for CI, merges and closes. Planner questions stop the run and go to `grill-me`.

Without a workflow you work interactively, see [Working mode](working-mode.md).

## Migrating

| Before | Now |
| :-- | :-- |
| `/orchestrator run <nr>` | `/deliver <nr>` |
| `/orchestrator plan <nr>` | `planner` (`Plan issue #<nr>.`) |
| `/orchestrator status <nr>` | the sub-issues and PRs on GitHub |
| `.dromos/config.json` | delete it; project settings are in `.agents/config.json` |
| `npm i -g @gravionlabs/dromos` | `npm uninstall -g @gravionlabs/dromos` |

Roles, models and effort of `/deliver` are set with `deliver.roles` in `.agents/config.json`, see the `deliver` skill (`references/roles.md`).
