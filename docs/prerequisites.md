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
| `agents` (also `core`, `all`) | [apmw](https://github.com/GravionLabs/apmw) (`pipx install apmw` or `uv tool install apmw`; prebuilt executables on its [releases](https://github.com/GravionLabs/apmw/releases)), required for OpenCode, recommended for Claude Code and Copilot (rewrites the agent frontmatter per client), see [apmw sanitize](#apmw-sanitize-agents-package) |
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

`apm install` copies the agent files of the `agents` package verbatim. Each client reads different frontmatter, so [`apmw sanitize`](https://github.com/GravionLabs/apmw) rewrites them per client (`apmw sanitize -g -p claude|opencode|copilot`, or `apmw install -p <client>` to install and sanitize in one step; add `-g` for a global install). Skills need no such step.

| Client | Extra step | Why |
| :-- | :-- | :-- |
| OpenCode | required | rejects the list-form `tools` and the unknown top-level keys of the source format |
| Claude Code | recommended | without it the per-agent `model` and Claude tool names under `metadata.claude` are not applied |
| GitHub Copilot | recommended | the source is Copilot style; sanitize only strips `metadata` and the OpenCode keys. Whether Copilot loads the unsanitized files without complaint is not verified here |

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

This was read from the APM docs, not run end to end here. The supported alternative is `apmw install` / `apmw update`, which wrap `apm` and sanitize afterwards.

## Troubleshooting

- **`pwsh: command not found`**: PowerShell 7 is not installed or not on `PATH`. Windows PowerShell 5.1 is not enough.
- **A script fails with a missing tool**: run the check with `-Full`; the output lists the install command per platform.
- **`gh` errors with authentication**: run `gh auth login`; the issue and PR skills need a token with `repo` scope.
- **Windows execution policy**: run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

## See also

- [README: quick start](../README.md#-quick-start)
- [Skills](concepts/skills.md)
- `.github/skills/check-prerequisites/SKILL.md`
