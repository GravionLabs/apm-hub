# Working mode: small contexts, one issue at a time

The cost of an agent session is its context size, not the skills it loads. In a 30-day sample (AgentLens, 79 sessions) issue sessions averaged 365k tokens per request and skill text made up about 1 % of it; PR and release skills ran at 500k because they were started at the end of long sessions. This page is the operating procedure that keeps contexts small. The skills in this hub assume it.

Everything here is interactive: you start a Claude Code, Copilot CLI or OpenCode session and name the skill or describe the task. The automated runner is described in [The runner](runner.md).

## 1. One issue per session

1. Start a fresh session in the repository.
2. Plan if the issue is large: `Plan issue #42.` (`planner` writes the plan one level down; after you approve, `github-issue` creates the sub-issues).
3. Implement: `Implement #42.` (`github-issue` reads the issue, `implementation` dispatches to the stack skill, tests change with the code).
4. Verify with the build and test commands of the project.
5. Review once: `Review the current diff.` (`code-review`). Fix blocking findings; the pull request is the second review.
6. Open the PR: `Create a PR for this branch.` (`github-pull-request`).
7. `/clear` (or close the session) before the next issue.

Title and labels follow the hierarchy `[Epic]`, `[Feature]`, `[PBI]`, `[Task]`, `[Bug]`; see `github-issue`.

## 2. Model choice

Sonnet is enough for every PBI without the label `interactive`. Use a larger model for planning large Epics and for work labelled `interactive`.

## 3. Keep the context small

- Watch the context yourself (`/context`, or the [status line](usage/statusline.md)). At about 150k tokens finish the step, leave a short hand-off note in the issue (what is done, what is next) and `/clear`.
- Start PR and release skills in a fresh session, never at the end of a long one.
- Load skills by name when the task is clear; descriptions alone already trigger them.
- Let the agent read files itself instead of pasting diffs or logs into the prompt.
- Do not run two issues in one session.

## 4. Guardrails

The `hooks` package installs a `PreToolUse` hook that denies destructive git commands (force push to `main`/`release/*`, `reset --hard`, `clean -f`, `branch -D`, `checkout -- .` on a dirty tree). Opt out with `GIT_GUARDRAILS_OFF=1`. Copilot CLI needs a manual setup, see [Copilot CLI hooks](usage/copilot-hooks.md).

## 5. Releases

`github-release cut` creates the rolling `release/next` branch, PBI pull requests target it, and `github-release finish` opens the release PR into `main` with the changelog.
