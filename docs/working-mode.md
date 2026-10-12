# Working mode: small contexts, one issue at a time

The cost of an agent session is its context size, not the skills it loads. In a 30-day sample
(AgentLens, 79 sessions) issue sessions averaged 365k tokens per request and skill text made up
about 1 % of it; PR and release skills ran at 500k because they were started at the end of long
sessions. This page is the operating procedure that keeps contexts small. The skills and agents in
this hub assume it.

## 1. Default: the orchestrator

Start issue work as the `lead` agent. It runs as the primary agent, keeps at most 300 words
per phase in its own context and hands the rest to `explorer`, `implementer` and `reviewer`.

```powershell
claude --agent lead "full 123"        # plan → implement → review → PR
claude --agent lead "plan 123"        # sub-issues only, stops at the approval gate
copilot --agent lead                  # GitHub Copilot CLI, then type: full 123
opencode --agent lead                 # OpenCode
```

Shell aliases save typing: `alias lead='claude --agent lead'`, `alias leadp='claude --agent lead plan'`.

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
  short hand-off note in the issue. A `lead` run keeps its own hand-off note: the ledger
  `.agents/<issue>/progress.md` (phases done, fix rounds, rulings); a new session resumes from it.
  On Claude Code the `claude-hooks` package adds a `Subagent <name>: stopped — <first line>` line for
  every finished subagent (`SubagentStop` hook, no-op without a ledger).
- OpenCode: `compaction: { auto: true, prune: true }` in `opencode.json` drops old tool output.

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
