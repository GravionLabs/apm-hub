# apm-hub packages

Install form: `apm install GravionLabs/apm-hub/packages/<pkg> [-g]` (direct path, not `apm marketplace add` or `<pkg>@apm-hub`: no registration step). Installs track the default branch; `-Ref <tag|sha>` pins one.

| Package | Brings | Install |
|:--|:--|:--|
| `shared` | `implementation`, `detect-techstack`, `diagnose`, `code-review` | project |
| `github` | `github-issue`, `github-pull-request`, `github-release` | project |
| `delivery` | review fan-out, verify, planning, retro, handoff, queue, `apm-install`; depends on `github` and `shared` | project |
| `agents` | `orchestrator` launcher skill and the nine agents (needs `apmw sanitize`) | project or `-g` |
| `hooks` | Claude Code hooks (ledger, context warning, git guardrails), OpenCode plugin | project or `-g` |
| `ts`, `py` | `<lang>-implementation`, `<lang>-test`, project scaffolding | per project |
| `ng` | Angular skills; depends on `angular/skills` (`angular-developer`) | per project |
| `dotnet` | .NET skills; depends on `dotnet/skills` (`dotnet` plugin) | per project |

## core vs all

- `core`: `github`, `delivery`, `shared`, `agents`, `hooks`, no stack skills. Use `core -g` once per machine and the stack
  package per project.
- `all`: every package except `apm-tooling`. Use it on machines that mix stacks, or when no per-project choice is wanted.
- `apm-tooling` (skill authoring and audit) is for contributors of this repository and never part of `all`.

## Detection mapping

detect-techstack emits `ts`, `js`, `py`, `dotnet`, `rust`: `ts` and `js` map to `ts`, `py` to `py`, `dotnet` to `dotnet`, `rust` to package `rust` (no such package exists yet: tell the user, install nothing). angular framework: `ng` (next to `ts`). tauri framework: informational, no package; a Tauri project reports `rust` and usually `ts`.
