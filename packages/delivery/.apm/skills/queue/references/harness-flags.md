# Harness flags

The adapters live in `scripts/harness/<name>.ps1`; `-DryRun` prints the exact command line and environment.
A headless run cannot answer permission prompts, so each adapter passes a narrow permission set by default.

| Harness | Narrow (default) | `-AllowAll` |
|:--|:--|:--|
| `claude` | `claude --agent orchestrator -p "<mode> <nr>" --allowedTools <list>` (Bash per git/gh subcommand and the build tools, Edit, Write) | `--dangerously-skip-permissions` |
| `copilot` | `copilot -p "<mode> <nr>" --agent=orchestrator --no-ask-user --allow-tool=write --allow-tool=shell(<cmd>:*)` for git, gh, pwsh, pnpm, npm, npx, node, dotnet, uv, python, ng | `--allow-all-tools` only |
| `opencode` | `opencode run --agent orchestrator "<mode> <nr>"` with env `OPENCODE_PERMISSION` (JSON: edit allow except `.git/**`, task, skill allow; bash `*` deny, listed prefixes allow) | `--auto`, no env |

The allowed prefixes live in `scripts/harness/allowed-commands.ps1` (one list for all adapters): `git` status, diff, log,
show, add, commit, checkout, switch, branch, fetch, push, rev-parse, rev-list, merge-base, ls-files, remote; `gh` issue
view/list/create/edit/close/comment, pr create/view/list/diff, repo view, api; plus pwsh, pnpm, npm, npx, node, dotnet,
uv, python, ng. `gh pr merge`, `git reset`, `git clean` and `git rebase` are not on the list, but that is not a guarantee:
`gh api` stays allowed (sub-issue and blocked-by linking need it, including POST and GraphQL) and can merge a PR, `git push`
also matches a force push (the git guardrails hook denies force pushes to `main` and `release/*`), and `pwsh` and the
build tools run arbitrary code.

`-FixAdvisories <policy>` (`none|medium|all[:dim,dim]`, only when given) is spliced into the same prompt string as its own token before the mode word: `-p "--fix-advisories medium full 101"` (claude, copilot) and the `opencode run` message; in `-Feature`/`-Epic` runs it precedes `next`. Without it the command is unchanged and the orchestrator applies its headless default `medium`, so no review-summary `Gate:`. CRITICAL and HIGH findings always block; the policy only decides which advisories (MEDIUM, LOW) join the fix round.

`-PbiParallel <m>` (1-4, only with `-Feature`/`-Epic`, only when given) is spliced the same way after `--fix-advisories`: `-p "--fix-advisories medium --pbi-parallel 2 next 10"`. The queue itself runs `next`, one PBI per process; the orchestrator reads the flag in `loop` mode (`loop-mode.md` Runner mode) and ignores it otherwise.

`-Parallel <n>` (1-4, only when given) is spliced in as `--parallel <n> ` right after the `--fix-advisories` token and before the mode word: `-p "--fix-advisories medium --parallel 2 full 101"`; in `-Feature`/`-Epic` runs it precedes `next` (the orchestrator forwards it to `pbi-runner`). Without it the command is unchanged and the Task-wave default applies. Not allowed with `-Status`.

Client recognition (checked against `orchestrator.agent.md` and `github-issue/references/orchestrator-gates.md`, not live): the flag handling is in the agent body, so it is the same on Claude Code, Copilot CLI and OpenCode. The orchestrator takes flags as separate unquoted tokens of the first message, in any position, removes them before reading the mode word and takes the next token as the value, so `--fix-advisories medium full 101` is recognized and the review summary is answered without a `Gate:`. The orchestrator accepts only lowercase dimensions (`^(none|medium|all)(:[a-z][a-z-]*(,[a-z][a-z-]*)*)?$`), the runner pattern is wider: an uppercase dimension passes the runner and then ends in a `Gate:` (exit 2).

## Trade-offs

- The narrow set limits accidents, it does not stop prompt injection: `gh api`, `pwsh` and the build tools can still do
  a lot, and issue text (especially via `-Label`) reaches the model. Run on collaborator-authored issues. `-TrustedOnly` filters only the issue author for `-Label`, not comments; positional issue numbers and `-IssueFile` are not filtered.
- OpenCode denies edits under `.git/`; the state dir (`<state>`, outside the working tree) stays writable because the subagents write their reports there.

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
- multi-word prefixes (`shell(git status:*)`, `Bash(git status:*)`, `"git status *"`) and the OpenCode `edit` path rules are from the docs, not exercised
- queue mode parses the run output (`Next PBI: #<n>`, `Gate:`, `Nothing selectable`, `<Feature|Epic> #<n> is done.`, `Verdict: APPROVE`) case-sensitively and the PBI ledger line `Phase pull-request: complete — <url>`
- `-Status <nr>` runs `status <nr>` once and parses `Gate:` and the line `Status: <state>/status-<nr>.md` (case-sensitive); it also needs `<state>/status-<nr>.md` written during the run, and reads no ledger

Report a working or broken flag set as an issue so the adapter and this table can be corrected.
