# Working mode: small contexts, one issue at a time

The cost of an agent session is its context size, not the skills it loads. In a 30-day sample
(AgentLens, 79 sessions) issue sessions averaged 365k tokens per request and skill text made up
about 1 % of it; PR and release skills ran at 500k because they were started at the end of long
sessions. This page is the operating procedure that keeps contexts small. The skills and agents in
this hub assume it.

## 1. Default: the orchestrator

This page covers usage. For how the orchestrator works internally (agents, state, gates, hooks) see [The orchestrator](orchestrator.md).

Start issue work as the `orchestrator` agent ([Setup](#setup) has the start commands). It runs as the primary agent, keeps at most 300 words
per phase in its own context and hands the rest to `explorer`, `planner`, `implementer` and `reviewer`.

### Modes and natural requests

The first word of the message is the mode; the issue type (Epic, Feature, PBI) comes from its label or title prefix. The first word must be the mode word (the table below is what to type, or what the `/orchestrator` command should translate your request to); a plain sentence without it runs `full`, which is for a PBI only.

| Mode | On | Does |
| :-- | :-- | :-- |
| `plan <nr>` | Epic / Feature / PBI | Epic → Features, Feature → PBIs (on request in the same run), PBI → tasks; one grilling cycle per level |
| `implement <nr>` | PBI | explore → implement → review → PR for a planned PBI |
| `full <nr>` | PBI | plan if needed, then implement |
| `next <nr>` | Feature / Epic | picks the first open PBI without open blocker or `needs-decision` (sub-issue order, recursive for an Epic), runs it like `full` |

Exactly one PBI per run. After a PBI of a Feature the end line is `Next: #<nr> <title> — orchestrator next <feature> after /clear`, or lists what blocks the rest, or says the Feature is done. Selection: `github-issue` `references/next-selection.md`.

| You say | Mode |
| :-- | :-- |
| "implementiere das nächste Feature" / "implement the next PBI of #81" | `next <feature>` |
| "work on the next PBI under epic #81" | `next <epic>` |
| "plan all open features under #81" | `plan 81`, then one `plan <feature>` per open Feature, each in its own session |
| "plan #123" / "plane Feature #123" | `plan 123` |
| "do #123" / "implement #123" | `full 123` / `implement 123` |

### Flags: overview and review summary

Two defaults, each switched off by a flag in the first message (also for `/orchestrator`):

| Flag | Default without it |
| :-- | :-- |
| `--no-overview` | Started with neither an issue number nor a description, the orchestrator first lists the open issues of the integration branch (`#<nr> <type> <status> <title>`; status open / in progress / merged, merged ones per the "Task merged" rule) and you pick one |
| `--no-review-summary` | After `review-fanout` it shows one line per finding (`severity file:line issue`, blocking first, MEDIUM/LOW included) and asks which advisories to fix; the rest go to the PR body. With the flag only blocking findings trigger fix rounds |

Headless runs write `Gate: <question>` to the ledger and stop. Details: `github-issue` `references/orchestrator-gates.md`.

### Setup

Start the orchestrator as the primary agent of a new session:

```powershell
claude --agent orchestrator "full 123"        # plan → implement → review → PR
claude --agent orchestrator "plan 123"        # plan file (plan.json) and next-level sub-issues after approval
copilot --agent orchestrator                  # GitHub Copilot CLI, then type: full 123
opencode --agent orchestrator                 # OpenCode
```

A shell alias saves typing (`~/.zshrc` or the PowerShell profile):

```powershell
alias claude-orchestrator='claude --agent orchestrator'     # then: claude-orchestrator "plan 123"
```

In a running Claude Code session a user-level command can start it inline, as `/orchestrator <mode> <issue>`.
Create `~/.claude/commands/orchestrator.md` (it is not part of the package):

```markdown
---
description: Run the orchestrator inline: /orchestrator [--no-overview] [--no-review-summary] plan|implement|full|next <issue>
---
Read ~/.claude/agents/orchestrator.md and follow its body as your instructions for this session.
Flags, mode and issue: $ARGUMENTS
```

The command runs the agent **inline**: the agent's tool restrictions and model are not enforced and the
session context keeps growing, so prefer `claude --agent orchestrator` for real work.

### Copilot CLI

`copilot --agent orchestrator` runs with the same modes, gates and ledger and delegates the phases with Copilot CLI's `task` tool (own context window per subagent, `subagentStop` hook). Copilot subagents are stateless, so fix rounds start a fresh `implementer` instead of resuming one. Only a session without the `task` tool falls back to running the phases inline. Client matrix: [Clients](orchestrator.md#clients). The `/orch` prompt (skill `orch-pipeline`) is deprecated and removed in 3.0.0; use the orchestrator agent instead.

### Start from a description

Instead of an issue number the orchestrator also accepts `<mode> <description>` (for example `full add a dark mode toggle`). It creates the PBI at the plan gate and then continues as `full`.

### One session per plan, one per PBI

Start a new session for each plan and for each PBI: `plan <issue>`, `/clear`, then `implement <issue>`.
The reason is cost: after an idle gap the prompt cache is rewritten, and a rewrite costs more the larger the
context is (in one measured session four such requests cost 0.17 to 0.39 USD each against 0.01 to 0.03 USD for a
normal request). Planning fills the context with exploration and answers that the implement run does not need;
it reads `.agents/<issue>/plan.json` and the Task issues. `plan` mode therefore ends with
`Next: /clear, then orchestrator implement <issue>`, and `full` mode offers the same stop after an approved plan
when the context is above 100k tokens.

### One session per issue, implement headless

The plan gate needs you, so plan interactively (`plan 123`, see [Setup](#setup)); an already planned issue runs headless, each issue in
its own session with a fresh context. `orchestrator` ends every run with its ledger, so the next issue never
inherits the previous one.

```powershell
claude --agent orchestrator -p "implement 123"          # headless: explore → implement → review → PR
copilot --agent orchestrator -p "implement 123"         # GitHub Copilot CLI
opencode run --agent orchestrator "implement 123"       # OpenCode
for n in 101 102 103; do claude --agent orchestrator -p "implement $n"; done
```

A headless run cannot answer permission prompts: allow `git`, `gh`, the build and test commands and
edits for the project beforehand (Claude: `permissions.allow` in the project settings). OpenCode needs nothing
extra for the ledger: the orchestrator's permission map allows `git`, `gh`, the tech-stack scan and one ledger
command, `pwsh <skills dir>/github-issue/scripts/Add-LedgerLine.ps1 -Issue <issue|adhoc> -Line '<text>'`, which creates
`.agents/<issue>/` and appends one line after validating the path (positive integer or `adhoc`, no line breaks, path under
`.agents/`, a symlinked `.agents/` is refused). The patterns pin the installed skill paths (`.claude/skills`, `.opencode/skills`,
`.agents/skills`, `.github/skills` in the project; `~/.claude/skills`, `~/.agents/skills`, `~/.config/opencode/skills` globally,
written literally with `~`: OpenCode does not expand `~` or `$HOME` in a pattern, so a model that writes the absolute home path gets a
prompt). The trailing `*` lets `pwsh` receive further arguments after the pinned script path; those are the script's own parameters
and are validated by the script. It keeps `edit: deny` and asks for every other shell command, which `opencode run` auto-rejects.
Claude Code has no per-agent bash list: allow `Bash(pwsh .claude/skills/github-issue/scripts/Add-LedgerLine.ps1 *)` and
`Bash(pwsh .claude/skills/detect-techstack/scripts/Detect-TechStack.ps1 *)` (or the global path).

Limits: a shell redirect is not part of the command OpenCode matches, so `pwsh .../Add-LedgerLine.ps1 ... > src/a.ts` would be allowed and could
truncate or create a file (it writes no content; a raw `echo *` rule would have allowed arbitrary content and was rejected).
`git *` and `gh *` are auto-allowed on OpenCode and can write files (`git diff --output=`, `git apply`, `gh api -X`), so the write
guard is not a boundary against a prompt-injected model in a headless OpenCode run. Other ledger-area writes are not covered
by the helper and still prompt, which a headless OpenCode run auto-rejects, or end in a `Gate:` stop: `.agents/overview.md`,
`.agents/adhoc/description.txt`, moving `.agents/adhoc` to `.agents/<issue>/`, and adding `.agents/` to `.git/info/exclude`.
Prefer an interactive or pre-prepared setup for description input and the issue overview.

It cannot answer a gate either: at a blocked review or a twice-red suite it appends `Gate: <question>` to
`.agents/<issue>/progress.md`, reports it and stops. Answer in an interactive `orchestrator` session, which
resumes from the ledger.

#### Headless smoke test and spike result (#222)

`pwsh scripts/Invoke-HeadlessSmoke.ps1 [-Client opencode|claude|both] [-Stage ledger|plan|all] [-Keep]` creates a throwaway
git repo without a remote (no GitHub writes) per client and stage and starts `opencode run --agent orchestrator` and
`claude -p --agent orchestrator`. Stage `ledger` (default) runs the ledger helper and asserts the header line in
`.agents/999/progress.md` and no permission prompt. Stage `plan` runs `plan <description>` with the full agent body and asserts
no permission prompt and a `Gate:` line or a completed phase in the ledger. A missing CLI is skipped (exit 2 when all are
skipped, 1 on a failure). It needs the CLIs and a model and is not run in CI. The OpenCode run uses the permission map of
`orchestrator.agent.md` in a project agent and an empty user config.

Spike (OpenCode 1.18.3, Claude Code, 2026-10-14/15):

- OpenCode before the fix (`"git *"`, `"gh *"` allow, `"*"` ask last): the ledger writes hit `ask`; `opencode run` printed
  `permission requested: bash (...); auto-rejecting` and no ledger was written. OpenCode lets the last matching rule win, so
  the trailing `"*": ask` also overrode `git *`/`gh *`; it is now first.
- OpenCode after the fix: the ledger helper runs, `rm -rf .agents/999` is still auto-rejected. Facts that shaped the rules:
  `[0-9]` is not a character class in a pattern (use `*`), and a redirect is not part of the matched command. Raw `mkdir`/`echo`/`tee`
  rules therefore cannot be made safe, so ledger writes go through the validating helper.
- Claude Code: without allow rules the run stops ("needs approval"); with `--allowedTools "Bash(pwsh .claude/skills/github-issue/scripts/Add-LedgerLine.ps1 *)"` the
  ledger helper completes. A project `.claude/settings.json` in a `/tmp` fixture was ignored.
- Plan stage (`plan <description>`, no remote): partially met. OpenCode ran the skill load and the tech-stack scan (allowed after adding the
  `Detect-TechStack.ps1` rules; before that it stopped there on a permission prompt), then the model issued `ls -la` outside the
  contract and it was auto-rejected. Claude Code reached the planner and a plan, then stopped at a `mkdir` under `.agents/` the model chose
  instead of the helper ("needs approval"). Neither run reached a `Gate:` line or a completed phase, so the plan/implement part of the
  acceptance criterion is only partially covered; the stage is opt-in because it depends on the model following the contract. An
  `implement` run needs a real issue and branch (GitHub) and was not run.

## 2. Without the orchestrator: one session per issue

- `claude "/github-issue 123"` — a fresh session per issue; `/clear` before the next one.
- Batch: `for n in 101 102 103; do claude -p "/github-issue $n"; done` — each issue in its own headless session.
- Parallel issues: `claude --worktree <name>` (own checkout and context per worktree); the
  `implementer` agent accepts `isolation: worktree` for the same effect inside the orchestrator.
- Copilot: a new chat per task in VS Code; `/clear` in the CLI. OpenCode: `/new`.

## 3. During a session

- On Claude Code the `hooks` package warns on the next prompt once the context passes 150k tokens:
  - `CONTEXT_WARN_TOKENS`: threshold, default 150000; a non-numeric, empty, negative or overlong value falls back to the default
  - lower it to be warned earlier, e.g. `export CONTEXT_WARN_TOKENS=100000`
  - `CONTEXT_WARN_STEP`: growth before the next warning, default 100000; it also falls back to the default on invalid values
  - then finish the step, note the hand-off in the ledger, `/clear`.
  - The hook parses the payload with `jq` when installed and with a
    bash fallback otherwise (escapes, pretty-printed JSON and any field order work either way). It never blocks and
    stays silent when parsing fails; set `CONTEXT_WARN_DEBUG=1` to get a one-line note on stderr instead.
- On Copilot CLI (manual setup, not installed by apm: see [Copilot CLI hooks](usage/copilot-hooks.md)) the same script runs as `postToolUse` (`userPromptSubmitted` cannot inject context), so the warning
  arrives after the next tool call, not on the next prompt. `postToolUse` has no `transcriptPath`; the hook reads
  `~/.copilot/session-state/<sessionId>/events.jsonl` (`COPILOT_HOME` overrides the directory) and takes `inputTokens`
  of the last `session.usage_record` event (it already contains cache reads and writes). Same thresholds, throttle
  and exit-0 behavior. Copilot versions that do not write `session.usage_record` stay silent: check `/context`
  or `/usage` yourself before a long step.
- The `hooks` package denies destructive git commands before they run (`PreToolUse` on Claude Code; `preToolUse` on
  Copilot CLI after the manual setup): force push (`--force`, `-f`, `--force-with-lease`) to `main` or `release/*`, `git push --delete` of them (except the rolling `release/next`, which `github-release cut` deletes and recreates),
  `git reset --hard`, `git clean -f`, `git branch -D`, and `git checkout -- .`/`git restore .` while the tree has
  uncommitted changes, also inside `env`, `sudo`, `bash -c`, `xargs` and similar wrappers, `git -c alias.*` values
  and `echo …`/heredocs piped into a shell. Every other command passes. Opt out per repo with
  `GIT_GUARDRAILS_OFF=1` in the environment or an (empty) file `.agents/guardrails.off`. OpenCode is not covered
  (it needs a plugin, see #182/#183). It is a guardrail against accidents, not a security boundary: it runs git
  only in the session's own repository (`git -C <other repo> checkout .` counts as dirty without looking, also for a
  nested or bare repo inside it), fails open on malformed payloads and on commands above 24 KB, and does not
  resolve variables (`$cmd`, `g${x}it`).
- `/context` before a long step shows what fills the window; the skill list and large tool outputs
  are the usual culprits.
- Ask the `explorer` agent instead of reading files yourself; keep its summary, not the files.
- Reviews read a package file (`.agents/<issue>/review-<n>.diff`: commit list, stat, diff with context)
  written by `review-fanout`; the diff is never pasted into a prompt, so it does not repeat per dimension.
- `review-fanout` runs five dimensions: `correctness`, `security`, `conventions`, `tests` and `spec`. `spec` compares
  the diff with the originating issue: the number comes from the argument, the branch `<type>/<nr>-<slug>` or
  `Closes #n` in the range, and the issue body plus its Task sub-issue bodies are appended to the same package
  file. It reports missing, partial or wrong criteria (HIGH) and scope creep (MEDIUM), never merged with
  `conventions` findings. No issue found: one advisory "no spec available", never a failure.
- `/compact <focus>` is a brake, not a habit: it loses detail you may need. Prefer `/clear` plus a
  short hand-off note in the issue. A `orchestrator` run keeps its own hand-off note: the ledger
  `.agents/<issue>/progress.md` (phases done, fix rounds, rulings); a new session resumes from it.
  The `hooks` package adds a `Subagent <name>: stopped — <first line>` line for
  every finished subagent (`SubagentStop` on Claude Code via apm, `subagentStop` on Copilot CLI after the manual setup; no-op without a ledger).
- **`handoff` or the ledger alone.** One issue: the ledger is the hand-off; `/clear` and resume with the orchestrator
  end line (`orchestrator next <feature>`). Work that spans several issues or several repositories, or that has open
  decisions the ledgers do not hold: run `handoff <focus of the next session>` before `/clear`. It writes
  `.agents/handoff-<date>.md` (normally git-excluded) with state per issue, gates, ordered commands and suggested skills,
  linking the ledgers instead of copying them. Start the next session with `Read .agents/handoff-<date>.md and continue`.
- OpenCode: `compaction: { auto: true, prune: true }` in `opencode.json` drops old tool output.

### Parallel and long sessions

- All sessions share one limit. `/usage` shows what drove it: the share of usage above 150k context,
  subagent-heavy sessions, 4+ sessions in parallel and sessions older than 8 hours.
- Queue instead of running four or more sessions at once; one issue per session, one session at a time,
  unless the issues are independent and each is small.
- A session older than 8 hours needs a reason (a watch, a loop). Otherwise write the hand-off into the
  ledger or a memory note and start a new session.

### Hooks by harness

| Hook | Claude Code | Copilot CLI | OpenCode |
| :-- | :-- | :-- | :-- |
| Subagent ledger line | `SubagentStop` | `subagentStop` (manual) | plugin `tool.execute.after` for `task` (`packages/hooks/.apm/opencode/plugins/apm-hub-hooks.ts`) |
| Context warning | `UserPromptSubmit` | `postToolUse` (manual) | same plugin: `message.updated` token usage, warning added as a synthetic part by `chat.message`; unknown until the first assistant reply after a restart |
| Git guardrails | `PreToolUse` | `preToolUse` (manual) | not available yet |

Each harness gets only its own events: `apm install` writes the Claude Code events (the manifests carry no camelCase events, which apm 0.33.0 would copy into Claude settings too); Copilot CLI hooks are a manual step, see [docs/usage/copilot-hooks.md](usage/copilot-hooks.md).

The OpenCode plugin is a single file that exports only its plugin function (OpenCode calls every function export as a
plugin and fails to load the file on other exports). `apm install` copies the whole package verbatim under `apm_modules`; the source path is
`packages/hooks/.apm/opencode/plugins/apm-hub-hooks.ts` (a local-path install gives
`apm_modules/_local/hooks/.apm/opencode/plugins/apm-hub-hooks.ts`; a marketplace install gives
`apm_modules/<owner>/apm-hub/packages/hooks/.apm/opencode/plugins/apm-hub-hooks.ts`). OpenCode loads it only from a plugins directory: `apmw sanitize -p opencode` is meant to place it there, but
that needs an apmw release with GravionLabs/apmw#38 (open). Until then copy the file by hand to `.opencode/plugins/`
(project) or `~/.config/opencode/plugins/` (global).

### Subagent context by harness

| | Claude Code | Copilot (VS Code) | Copilot CLI | OpenCode |
| :-- | :-- | :-- | :-- | :-- |
| Does a subagent inherit the conversation? | only the `fork` type; every typed agent starts fresh (about 6k tokens, measured) | no, fresh and stateless | unverified | unverified |
| Resume a finished subagent | `SendMessage` to its agent id | no | unverified | unverified |
| `orchestrator` cannot be dispatched as a subagent by | the rule in its body | `disable-model-invocation: true` | unverified | `mode: primary` |

`fork` is the expensive one: it starts with the whole session, so in a 700k-token session every fork
re-reads 700k tokens. In four days of the owner's usage 22 model-started `fork` calls made up 23 % of
usage. Rule: no `fork` above ~100k context; start a typed agent (`explorer`, `general-purpose`) with a
self-contained prompt instead. Put the rule into the global instruction file of each client
(Claude `~/.claude/CLAUDE.md`, Copilot `.github/copilot-instructions.md` or the VS Code user instructions,
OpenCode `~/.config/opencode/AGENTS.md`):

```text
Subagents: write a self-contained prompt (goal, context, expected result).
Never use the `fork` subagent type once the session is above ~100k tokens; use `explorer`, `general-purpose` or another typed agent.
Run `orchestrator` only as the primary agent, never as a subagent.
```

## 4. PR and release in a fresh session

Commit and push, then `/clear`, then `/github-pull-request`. `/github-release finish` likewise. Both
skills read everything they need from `git` and `gh`; they never depend on the session history,
and on Claude Code they run with `context: fork`, so even at the end of a long session they start
with a fresh context.
The release PR itself is opened and refreshed by CI on every push to `release/next`. After it is merged, CI writes the changelog, tags, publishes the release and closes the
issues the merged PRs reference with `Closes #n`; nothing is closed by hand.

## 5. Keep the skill list short

- Skills that create a project or set up tooling once carry `disable-model-invocation: true` (see
  [skill-frontmatter.md](concepts/skill-frontmatter.md)); their descriptions leave the model's list.
  Nothing used during an implementation or at the end of a feature is gated: `github-release` stays
  model-invocable, and mid-task references (uv flags, component or signal-store scaffolding) live in
  `references/` of `py-implementation` and `ng-implementation`.
- Gating is the smallest lever: the 19 consumer-visible model-invocable descriptions are held to a
  budget of 2,600 characters in total (≈ 650 tokens at chars/4, currently 2,443 ≈ 611 tokens, measured 2026-10-14 with the budget check),
  enforced by `src/generators/skill-size-validator.test.ts`. `packages/apm-tooling` (contributor
  tooling, not in `all`, never loaded by consumers) is excluded from the budget and keeps only the
  200-character per-skill limit. Token figures not marked as measured are AgentLens estimates from the 30-day, 79-session sample (as of 2026-10-14), not re-measured. The
  system prompt is prompt-cached. Per-project
  package installs remove more (≈ 10 skills in a single-stack repository).
- Two-level install: globally `apm install GravionLabs/apm-hub/packages/core -g` (workflow skills
  and agents, no stack skills); per project an `apm.yml` with the stack package (`ng`, `ts`, `py`,
  `dotnet`). `all@apm-hub` only on machines that mix stacks. Deployed skill folders are git-ignored,
  so a fresh clone runs `apm install` first. A workflow skill that needs a stack skill which is not
  installed says so once ("install `<stack>@apm-hub`") and continues with the language-agnostic rules.
- Weekly: `/skill-doctor` in Claude Code and `agentlens skills --since <date>`; a skill unused for
  a month is a candidate for gating or removal.

## 6. Where context goes (reference numbers)

| Item                                   | Tokens per request | Lever                                   |
| :------------------------------------- | -----------------: | :-------------------------------------- |
| 19 model-invocable skill descriptions  |       ≈611 (computed: 2,443 characters / 4) | shorter descriptions (done: 2,600-character budget, 2,443 characters used, measured 2026-10-14), per-project installs |
| CLAUDE.md / AGENTS.md of the project   |         500–3,000 | keep under 200 lines, move rules to skills |
| one full file read (300 lines)         |          3,000–5,000 | `explorer` summary instead (≤ 400)     |
| one build or test log                  |         2,000–20,000 | `verify-project` runs forked           |
| conversation history after 2 hours     |      150,000–500,000 | one issue per session                   |

The 19-description row is computed from the characters (chars/4); an earlier AgentLens estimate of ≈470 tokens covered 18 descriptions and was not re-measured. Rows 2 to 5 are AgentLens estimates (ranges) from the 30-day, 79-session sample, as of 2026-10-14; they were not re-measured.
