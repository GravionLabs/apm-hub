# Prerequisites

Tools that apm-hub skills and their scripts depend on. Check your machine with the repo-local `check-prerequisites` skill:

```powershell
pwsh .github/skills/check-prerequisites/scripts/Check-Prerequisites.ps1          # core tools
pwsh .github/skills/check-prerequisites/scripts/Check-Prerequisites.ps1 -Full    # plus optional tools
pwsh .github/skills/check-prerequisites/scripts/Check-Prerequisites.ps1 -AutoInstall
```

`-AutoInstall` uses `winget` (Windows), `brew` (macOS) or `apt-get` / `dnf` (Linux).

## Core (every package)

| Tool | Version | Why |
| :-- | :-- | :-- |
| [PowerShell](https://github.com/PowerShell/PowerShell) | 7.4+ | All skill scripts are `pwsh` scripts. `detect-techstack` has a manual fallback, but scaffolding and report scripts need it. |
| [Git](https://git-scm.com/) | 2.40+ | Branching, commits, diffs in every workflow skill |
| [APM CLI](https://microsoft.github.io/apm/) | latest | Installs the packages (`curl -sSL https://aka.ms/apm-unix \| sh` or `winget install Microsoft.APM`) |

Install PowerShell:

```powershell
winget install Microsoft.PowerShell        # Windows
brew install powershell/tap/powershell     # macOS
# Linux: https://learn.microsoft.com/powershell/scripting/install/install-linux
```

## Per package

| Package | Tools |
| :-- | :-- |
| `github`, `delivery` | [GitHub CLI](https://cli.github.com/) `gh` 2.40+, authenticated (`gh auth status`). `github-release` installs [git-cliff](https://git-cliff.org/) itself when the changelog is generated. |
| `ts` | Node.js 22 LTS, npm; pnpm for `ts-pnpm-workflow` (the skill installs it) |
| `ng` | Node.js 22 LTS, Angular CLI 21+ (`npm i -g @angular/cli`) |
| `py` | Python 3.14, [uv](https://docs.astral.sh/uv/) |
| `dotnet` | .NET SDK 10 (libraries multi-target `net10.0;net9.0;net8.0`) |
| `agents` (also `core`, `all`) | [apmw](https://github.com/GravionLabs/apmw) (`uv tool install apmw` or `pipx install apmw`; prebuilt executables on its [releases](https://github.com/GravionLabs/apmw/releases)): `apmw install`/`apmw update` run `apm` and rewrite the agent frontmatter per client. Required for OpenCode and Claude Code (without it Claude Code starts the agents without tools), Copilot reads the source format, see [below](#apmw-sanitize-agents-package) |
| `shared`, `apm-tooling` | PowerShell and Git only |

Install the runtimes with your platform's package manager, for example:

```powershell
winget install OpenJS.NodeJS.LTS GitHub.cli Microsoft.DotNet.SDK.10 Python.Python.3.14 astral-sh.uv   # Windows
brew install node gh dotnet-sdk python@3.14 uv                                                        # macOS
```

## Optional

`jq`, `yq`, `curl`, `ast-grep` and `apmw` are checked by `-Full`. A few scripts use `jq` and `curl` when present; none of the current skills require `yq` or `ast-grep`.

Language servers for Copilot CLI are described in [LSP configuration](lsp-configuration.md).

## apmw sanitize (agents package)

`apm install` and `apm update` copy the agent files of the `agents` package verbatim, in the source format. Each client reads different frontmatter, so [`apmw`](https://github.com/GravionLabs/apmw) rewrites them per client. The command for a package with agents is therefore `apmw install -p <client>` resp. `apmw update -p <client>` (`-g` for the global install), which run `apm` and then `apmw sanitize -p <client>`. After a plain `apm install`/`apm update`, `apmw sanitize -g -p claude|opencode|copilot` repairs the files. Skills need no such step.

| Client | Without sanitize | Why |
| :-- | :-- | :-- |
| OpenCode | agents rejected | rejects the list-form `tools` and the unknown top-level keys of the source format |
| Claude Code | agents start without tools | the Copilot aliases `agent, read, search, execute` resolve to no Claude tool: a subagent fails to launch ("would be spawned with zero tools"), a primary agent prints its tool calls as text; the per-agent `model` under `metadata.claude` is not applied either |
| GitHub Copilot | works | the source is Copilot style; sanitize only strips `metadata` and the OpenCode keys. Whether Copilot loads the unsanitized files without complaint is not verified here |

Three safety nets catch a forgotten sanitize: the `apm-install` skill runs `apmw sanitize` itself after installing `agents`, `core` or `all`; the `hooks` package heals the Claude Code agent directories at session start (`agent-sanitize.sh`, [orchestrator § Hooks](orchestrator.md#hooks)); and the lifecycle hook below makes every `apm install`/`apm update` sanitize.

### Can the sanitize run automatically?

Evaluated against APM's [lifecycle scripts](https://microsoft.github.io/apm/enterprise/lifecycle-scripts/): `post-install` and `post-update` events exist, but scripts are read only from the consumer's own `apm.yml` (project), `~/.apm/apm.yml` (user) and the admin policy directory, never from an installed package. apm-hub therefore cannot ship the hook inside a package. A consumer can add it once; project scripts must be trusted with `apm lifecycle trust`. Matching the global install in the README, put the hook in `~/.apm/apm.yml` and sanitize with `-g` for all three platforms:

```yaml
lifecycle:
  post-install:
    - type: command
      command: "apmw sanitize -g -p claude; apmw sanitize -g -p opencode; apmw sanitize -g -p copilot"
  post-update:
    - type: command
      command: "apmw sanitize -g -p claude; apmw sanitize -g -p opencode; apmw sanitize -g -p copilot"
```

For a project install, put the hook in the project `apm.yml` instead and drop `-g` (sanitizes the project agent directories, e.g. `-p claude` only for Claude Code). `-g` targets the user-level agent directories; without it only the project ones are rewritten.

Verified on 2026-10-26 with apm 0.35.0: the user-level block in `~/.apm/apm.yml` fires on `apm install -g` (tested in a separate home directory with a marker command); project blocks need `apm lifecycle trust` once. The log is `~/.apm/logs/scripts.log`. `apmw install` / `apmw update` remain the one-command form without the hook.

## Troubleshooting

- **`pwsh: command not found`**: PowerShell 7 is not installed or not on `PATH`. Windows PowerShell 5.1 is not enough.
- **A script fails with a missing tool**: run the check with `-Full`; the output lists the install command per platform.
- **`gh` errors with authentication**: run `gh auth login`; the issue and PR skills need a token with `repo` scope.
- **Windows execution policy**: run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

## See also

- [README: quick start](../README.md#-quick-start)
- [Skills](concepts/skills.md)
- `.github/skills/check-prerequisites/SKILL.md`
