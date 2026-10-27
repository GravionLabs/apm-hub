# apm-hub packages

Install form: `apm install GravionLabs/apm-hub/packages/<pkg> [-g]` (direct path, not `apm marketplace add` or `<pkg>@apm-hub`: no registration step). Installs track the default branch; `-Ref <tag|sha>` pins one.

| Package | Brings | Install |
|:--|:--|:--|
| `shared` | `implementation`, `detect-techstack`, `diagnose`, `code-review` | project |
| `github` | `github-issue`, `github-pull-request`, `github-release` | project |
| `delivery` | planning, retro, `apm-install`; depends on `github` and `shared` | project |
| `agents` | `orchestrator` launcher skill and the nine agents (the script runs `apmw sanitize` after the install; `apmw` must be installed) | project or `-g` |
| `hooks` | Claude Code git guardrails hook | project or `-g` |
| `statusline` | `context-statusline` skill (status line and subagent status line) | project or `-g` |
| `ts`, `py` | `<lang>-implementation`, `<lang>-test`, project scaffolding | per project |
| `rust` | `rust-implementation`, `rust-test` | per project |
| `ng` | Angular skills; depends on `angular/skills` (`angular-developer`) | per project |
| `dotnet` | .NET skills; depends on `dotnet/skills` (`dotnet` plugin) | per project |

## core vs all

- `core`: `github`, `delivery`, `shared`, `agents`, `hooks`, `statusline`, no stack skills. Use `core -g` once per machine and the stack
  package per project.
- `all`: every package except `apm-tooling`. Use it on machines that mix stacks, or when no per-project choice is wanted.
- `apm-tooling` (skill authoring and audit) is for contributors of this repository and never part of `all`.

## Detection mapping

detect-techstack emits `ts`, `js`, `py`, `dotnet`, `rust`: `ts` and `js` map to `ts`, `py` to `py`, `dotnet` to `dotnet`, `rust` to `rust`. angular framework: `ng` (next to `ts`). tauri framework: informational, no package; a Tauri project reports `rust` and usually `ts`, so both packages are proposed.
