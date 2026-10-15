# Harness flags

The adapters live in `scripts/harness/<name>.ps1`; `-DryRun` prints the exact command line and environment.
A headless run cannot answer permission prompts, so each adapter passes a narrow permission set by default.

| Harness | Narrow (default) | `-AllowAll` |
|:--|:--|:--|
| `claude` | `claude --agent orchestrator -p "<mode> <nr>" --allowedTools <list>` (Bash for git, gh, pwsh and the build tools, Edit, Write) | `--dangerously-skip-permissions` |
| `copilot` | `copilot -p "<mode> <nr>" --agent=orchestrator --no-ask-user --allow-tool=write --allow-tool=shell(<cmd>:*)` for git, gh, pwsh, pnpm, npm, npx, node, dotnet, uv, python, ng | `--allow-all-tools` only |
| `opencode` | `opencode run --agent orchestrator "<mode> <nr>"` with env `OPENCODE_PERMISSION` (JSON: edit, task, skill allow; bash `*` deny, listed commands allow) | `--auto`, no env |

## Trade-offs

- Narrow: the model cannot run commands outside the list (no `rm`, `curl`, `sudo`), at the price of stalls
  or failures when a project needs another tool. Extend the list in the adapter or fall back to `-AllowAll`.
- `-AllowAll`: never stalls on a prompt, but a wrong or injected command runs unchecked. Use it only in a
  throwaway checkout, container or VM, never with secrets in the environment.
- `OPENCODE_PERMISSION` is read from the environment of the child process only (set and restored by the runner);
  it is merged into the OpenCode config permission map and wins over project settings for that run.

## Copilot CLI: no subagents headless

Do not rely on subagents in a headless `copilot -p` run (the `task` tool is not available there as far as known):
the orchestrator then runs the phases inline in one context instead of delegating to `explorer`, `implementer` and `reviewer`. Expect higher context use
per issue and a smaller issue size limit than with Claude Code or OpenCode. See [Clients](https://github.com/GravionLabs/apm-hub/blob/main/docs/orchestrator.md#clients).

## Not verified live

Verified only against `--help` output (claude, copilot, opencode 1.18.3) and the unit tests with fake binaries;
no live headless run exists yet:

- the Claude `--allowedTools` list is a best guess
- Copilot: tool kind `write` and the `shell(<cmd>:*)` patterns come from the help examples; the help text says
  `--allow-all-tools` is required for non-interactive mode, so the narrow set may stall. If a Copilot run hangs or
  denies every tool, rerun with `-AllowAll`
- OpenCode: the keys `edit`, `task`, `skill`, `bash` and the `"git *"` patterns are from the docs, not exercised
- output parsing for queue mode relies on `PR #<n>`, `/pull/<n>` and `APPROVE` appearing in the run output

Report a working or broken flag set as an issue so the adapter and this table can be corrected.
