# The runner

apm-hub contains no pipeline. It ships skills; the runner that chains them (plan, implement, review, pull request, one PBI after another) lives in [dromos](https://github.com/GravionLabs/dromos). Why the split was made is in the [simplification plan](simplification-plan.md).

Until the runner is released you work interactively, see [Working mode](working-mode.md).

## What the runner does

`dromos run task|pbi|feature|epic <nr> --harness claude|copilot` starts harness sessions (Claude Code or Copilot CLI) and gives each phase a skill from this hub: `issue-planning` for planning, `implementation` with the stack skills for the change, `code-review` for the review, `github-pull-request` for the PR. Control flow, state and events belong to dromos; the skills stay the same whether you call them by hand or through the runner.

## Install

```bash
npm i -g dromos
apm install GravionLabs/apm-hub/packages/core -g   # the skills the runner calls
```

Per project add the stack package (`ts`, `py`, `ng`, `dotnet`, `rust`).

## Commands

| Command                   | Does                                              |
| :------------------------ | :------------------------------------------------ |
| `dromos run task <nr>`    | implements one Task                               |
| `dromos run pbi <nr>`     | plans if needed, implements the PBI, opens the PR |
| `dromos run feature <nr>` | runs the PBIs of a Feature in dependency order    |
| `dromos run epic <nr>`    | plans missing Features and PBIs, then runs them   |

Options, configuration and the event log are documented in the [dromos README](https://github.com/GravionLabs/dromos#readme).
