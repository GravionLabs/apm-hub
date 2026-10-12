# Working mode: small contexts, one issue at a time

The cost of an agent session is its context size, not the skills it loads. In a 30-day sample
(AgentLens, 79 sessions) issue sessions averaged 365k tokens per request and skill text made up
about 1 % of it; PR and release skills ran at 500k because they were started at the end of long
sessions. This page is the operating procedure that keeps contexts small. The skills and agents in
this hub assume it.

## 1. Default: the orchestrator

Start issue work as the `orchestrator` agent. It runs as the primary agent, keeps at most 300 words
per phase in its own context and hands the rest to `explorer`, `implementer` and `reviewer`.

```powershell
claude --agent orchestrator "full 123"        # plan → implement → review → PR
claude --agent orchestrator "plan 123"        # sub-issues only, stops at the approval gate
copilot --agent orchestrator                  # GitHub Copilot CLI, then type: full 123
opencode --agent orchestrator                 # OpenCode
```

### Setup

Start the orchestrator as the primary agent of a new session:

```powershell
claude --agent orchestrator "full 123"
copilot --agent orchestrator
opencode --agent orchestrator
```

A shell alias saves typing (`~/.zshrc` or the PowerShell profile):

```powershell
alias claude-orchestrator='claude --agent orchestrator'     # then: claude-orchestrator "plan 123"
```

In a running Claude Code session a user-level command can start it inline, as `/orchestrator <mode> <issue>`.
Create `~/.claude/commands/orchestrator.md` (it is not part of the package):

```markdown
---
description: Run the orchestrator inline: /orchestrator plan|implement|full <issue>
---
Read ~/.claude/agents/orchestrator.md and follow its body as your instructions for this session.
Mode and issue: $ARGUMENTS
```

The command runs the agent **inline**: the agent's tool restrictions and model are not enforced and the
session context keeps growing, so prefer `claude --agent orchestrator` for real work.

### `/orch` or the orchestrator

The names look alike but the tools differ on purpose; this table explains the clash once.

| | `/orch` (skill `orch-pipeline`) | `orchestrator` (agent) |
| :-- | :-- | :-- |
| Runs | inline in the current session | as the primary agent; every phase in a subagent |
| Work | one issue or description, up to 5 tasks | any issue, including Epics and Features (plans sub-issues) |
| Context | grows in the current session | keeps at most 300 words per phase |
| Gates | plan and commit | plan, blocked review, red suite |
| Start | `/orch feature\|fix\|review <issue or text>` | `claude --agent orchestrator "full 123"` |
| Use for | a small change in a session that is already warm | a planned issue, larger work, cost control |

### One session per issue, implement headless

The plan gate needs you, so plan interactively; an already planned issue runs headless, each issue in
its own session with a fresh context. `orchestrator` ends every run with its ledger, so the next issue never
inherits the previous one.

```powershell
claude --agent orchestrator "plan 123"                  # interactive: sub-issues, approval gate
claude --agent orchestrator -p "implement 123"          # headless: explore → implement → review → PR
copilot --agent orchestrator -p "implement 123"         # GitHub Copilot CLI
opencode run --agent orchestrator "implement 123"       # OpenCode
for n in 101 102 103; do claude --agent orchestrator -p "implement $n"; done
```

A headless run cannot answer permission prompts: allow `git`, `gh`, the build and test commands and
edits for the project beforehand (Claude: `permissions.allow` in the project settings). It cannot answer a
gate either: at a blocked review or a twice-red suite it appends `Gate: <question>` to
`.agents/<issue>/progress.md`, reports it and stops. Answer in an interactive `orchestrator` session, which
resumes from the ledger.

## 2. Without the orchestrator: one session per issue

- `claude "/github-issue 123"` — a fresh session per issue; `/clear` before the next one.
- Batch: `for n in 101 102 103; do claude -p "/github-issue $n"; done` — each issue in its own headless session.
- Parallel issues: `claude --worktree <name>` (own checkout and context per worktree); the
  `implementer` agent accepts `isolation: worktree` for the same effect inside the orchestrator.
- Copilot: a new chat per task in VS Code; `/clear` in the CLI. OpenCode: `/new`.

## 3. During a session

- On Claude Code the `claude-hooks` package warns on the next prompt once the context passes 150k tokens
  (`CONTEXT_WARN_TOKENS`, repeated after another `CONTEXT_WARN_STEP`, default 100k): finish the step,
  note the hand-off in the ledger, `/clear`.
- `/context` before a long step shows what fills the window; the skill list and large tool outputs
  are the usual culprits.
- Ask the `explorer` agent instead of reading files yourself; keep its summary, not the files.
- Reviews read a package file (`.agents/<issue>/review-<n>.diff`: commit list, stat, diff with context)
  written by `review-fanout`; the diff is never pasted into a prompt, so it does not repeat per dimension.
- `/compact <focus>` is a brake, not a habit: it loses detail you may need. Prefer `/clear` plus a
  short hand-off note in the issue. A `orchestrator` run keeps its own hand-off note: the ledger
  `.agents/<issue>/progress.md` (phases done, fix rounds, rulings); a new session resumes from it.
  On Claude Code the `claude-hooks` package adds a `Subagent <name>: stopped — <first line>` line for
  every finished subagent (`SubagentStop` hook, no-op without a ledger).
- OpenCode: `compaction: { auto: true, prune: true }` in `opencode.json` drops old tool output.

### Parallel and long sessions

- All sessions share one limit. `/usage` shows what drove it: the share of usage above 150k context,
  subagent-heavy sessions, 4+ sessions in parallel and sessions older than 8 hours.
- Queue instead of running four or more sessions at once; one issue per session, one session at a time,
  unless the issues are independent and each is small.
- A session older than 8 hours needs a reason (a watch, a loop). Otherwise write the hand-off into the
  ledger or a memory note and start a new session.

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
Run `orchestrator` only as the primary agent (`claude --agent orchestrator`), never as a subagent.
```

## 4. PR and release in a fresh session

Commit and push, then `/clear`, then `/github-pull-request`. `/github-release finish` likewise. Both
skills read everything they need from `git` and `gh`; they never depend on the session history,
and on Claude Code they run with `context: fork`, so even at the end of a long session they start
with a fresh context.
The release PR itself is opened and refreshed by CI on every push to `release/<x.y>`. After it is merged, CI writes the changelog, tags, publishes the release and closes the
issues the merged PRs reference with `Closes #n`; nothing is closed by hand.

## 5. Keep the skill list short

- Skills that create a project or set up tooling once carry `disable-model-invocation: true` (see
  [skill-frontmatter.md](concepts/skill-frontmatter.md)); their descriptions leave the model's list.
  Nothing used during an implementation or at the end of a feature is gated: `github-release` stays
  model-invocable, and mid-task references (uv flags, component or signal-store scaffolding) live in
  `references/` of `py-implementation` and `ng-implementation`.
- Gating is the smallest lever: the whole list of 34 descriptions costs ≈ 1,480 tokens after the
  200-character limit, gating removes ≈ 550 of them, and the system prompt is prompt-cached.
  Per-project package installs remove more (≈ 10 skills in a single-stack repository).
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
| 31 skill descriptions in the list      |             ≈1,970 | shorter descriptions (done: 34 skills ≈ 1,480, ≈ 930 visible after gating), per-project installs |
| CLAUDE.md / AGENTS.md of the project   |         500–3,000 | keep under 200 lines, move rules to skills |
| one full file read (300 lines)         |          3,000–5,000 | `explorer` summary instead (≤ 400)     |
| one build or test log                  |         2,000–20,000 | `verify-project` runs forked           |
| conversation history after 2 hours     |      150,000–500,000 | one issue per session                   |
