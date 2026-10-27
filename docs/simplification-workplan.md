# Simplification work plan: apm-hub and dromos

Status: approved direction, 2026-10-27, review corrections applied the same day. Architecture and reasoning: [simplification-plan.md](simplification-plan.md). This document is the backlog. Every `[Epic]`, `[Feature]` and `[PBI]` below exists as a GitHub issue with the same title; the `Done when` lines are the acceptance criteria, `Depends on` lines are native blocked-by links. Sizes: S (one sitting), M (one day). There is no L: anything larger is split.

Order of work, as decided:

1. **Stage A: clean apm-hub first.** Delete every test, script, skill, agent, hook and document that the runner model does not need. apm-hub ends Stage A as a content-only repository with a green, fast test suite.
2. **Stage B: build the runner in dromos.** apm-hub is adapted in parallel (role skills, thin launcher skill, docs).
3. **Stage C: metrics, retro, release.**

Consequence of the order, accepted: between the end of Stage A and the first usable `dromos run pbi` there is no automated pipeline. Work in that window is done interactively with the skills that stay (section 6). Three things survive Stage A until their replacement exists:

- the git-guardrails `PreToolUse` hook (removed by P9 after dromos B3 ports it),
- the Copilot SDK harness (B5 takes it from the tag `v2.5.4`, so A13 may delete it),
- the old pipeline as an installable pin: `v2.5.4` is the last release with agents, hooks and queue.

**Who implements what.** Every PBI without the label `interactive` is written to be implemented by an unattended Sonnet session: paths are named, the decision is made, the PBI body is self-contained. PBIs labelled `interactive` (B6b, B10b, P8) need a human in the loop: they measure or decide. A8 carries a default decision that can be changed before it starts, never in its PR.

Milestones: apm-hub `3.0.0` (Stage A), `3.1.0` (P1-P9); dromos `0.2.0` (B1-B6b), `0.3.0` (B7-B17), `0.4.0` (B18-B21). The unreleased milestones of the earlier roadmap were renamed to `<version> (old roadmap)` and closed during the triage (section 0).

---

## 0. Triage, done 2026-10-27

Before any issue of this plan was created, every open issue of both repositories was triaged. Classes: `done` (merged into `release/next`, closed as completed), `superseded` (closed as not planned with a comment linking this plan and the successor PBI where one exists), `keep` (stays open in the backlog without a milestone), `parked` (label `parked`, no milestone). The full table is a comment on each repository's Stage Epic.

- apm-hub: done 519, 537, 538, 578, 579, 581, 594, 595, 626, 643, 659, 660, 668, 674-682, 687, 688, 690-692, 704-711; superseded 280, 300, 384, 387, 390-394, 398, 422-425, 431, 432, 450, 478, 487, 495, 499, 501, 503-506, 530, 531, 539, 541, 543, 566, 573-577, 580, 582-592, 689, 696-702; keep 411, 413, 418-421, 427, 520, 556-562, 658, 661.
- dromos: done 132, 136; superseded 29-31, 61-65, 69, 101, 104-106, 114, 133, 134, 137, 138, 159-162, 180, 186; keep 26, 28, 70, 98-100, 102, 103, 107, 131, 150, 163, 165-172; parked 36, 45-47, 49, 50, 54, 56-59, 66, 68.
- Released milestones closed as they are: apm-hub 2.4.0, 2.5.0, dromos 0.1.0. Unreleased milestones renamed to `<version> (old roadmap)` and closed: apm-hub 2.6.0-2.8.0, dromos 0.2.0-0.5.0. apm-hub `3.0.0` is reused for Stage A.

---

## 1. Stage A: apm-hub cleanup

Repository: `GravionLabs/apm-hub`. Target version 3.0.0 (breaking: agents, hooks except the git guardrails, orchestration removed). Work happens on `release/next`, one PBI per PR, in the order below. Each PBI deletes code **and** its tests **and** its documentation in the same PR; no PBI leaves a dangling reference (checked by `Get-SkillReport.ps1` and `node scripts/check-manifests.mjs`).

### [Epic] chore: apm-hub becomes a content-only repository (3.0.0)

Done when: `packages/agents`, the hooks package except the git guardrails, `packages/delivery/.apm/skills/{queue,review-fanout,verify-project,handoff,orch-pipeline}` and all orchestration state scripts are gone; `pnpm test` runs one vitest project in under 60 s with no process spawn except the stack-skill and guardrail script tests; `AGENTS.md`, `README.md`, `docs/` describe only skills; 3.0.0 is released.

#### [Feature] chore: freeze and inventory

| # | PBI | Size | Done when | Depends on |
|---|---|---|---|---|
| A1 | `[PBI] chore: freeze the pipeline in ROADMAP and CONTRIBUTING` | S | `ROADMAP.md` gets a "Superseded by simplification-plan.md" section at the top that lists the removed roadmap items (Epics #300, #384, #387, #573 and their Features) and links both simplification documents; `CONTRIBUTING.md` states that no pipeline features (agents, hooks, queue, ledger, gates, loop) are accepted any more, bug fixes only until Stage A removes them; `docs/simplification-plan.md` and `docs/simplification-workplan.md` are linked from `README.md` | — |
| A2 | `[PBI] chore: inventory of files to delete and files to keep` | S | `docs/simplification-inventory.md` lists every tracked path under `packages/`, `test/`, `scripts/`, `src/`, `site/`, `.github/` (directories may be listed as one line when everything below shares the class) with one of `keep`, `delete (A<n>)`, `move (GravionLabs/ci)`, `rewrite (P<n>)`; the PBI number in parentheses names the PBI that removes or rewrites it; `README.md` gets a short "Old pipeline" note: the orchestrator, agents, hooks and queue are last available in `v2.5.4`, pin with `apm install GravionLabs/apm-hub/packages/agents#v2.5.4` | A1 |

#### [Feature] chore: remove orchestration packages and their tests

| # | PBI | Size | Done when | Depends on |
|---|---|---|---|---|
| A3 | `[PBI] chore: remove the agents package` | M | `packages/agents/` deleted (nine `*.agent.md`, `orchestrator` skill); `test/packages/agents/` deleted; `src/generators/agent-list*` and `docs/agent-list.md` deleted, CI step that regenerates it removed; `src/generators/agent-size-validator*` deleted; `apm.yml` (root, `core`, `all`) no longer lists `agents`; `docs/concepts/agent-frontmatter.md` deleted; `AGENTS.md` and `README.md` agent sections removed; an issue is opened in `GravionLabs/apmw` to remove `sanitize` and the agent goldens (link in the PR body, not done here) | A2 |
| A4 | `[PBI] chore: reduce the hooks package to the git guardrails, move the status line to its own package` | M | deleted from `packages/hooks/.apm/hooks/`: subagent-ledger, context warning, agent-sanitize, and the OpenCode plugin under `packages/hooks/.apm/opencode/`; the git-guardrails `PreToolUse` hook and its tests stay in `packages/hooks` (removed later by P9); `context-statusline` skill moved to a new package `packages/statusline/` with `Install-Statusline.ps1` and its tests; `test/packages/hooks/` keeps only the guardrail tests, the statusline tests move to `test/packages/statusline/`; `docs/usage/copilot-hooks.md` reduced to the guardrails; `docs/usage/statusline.md` updated; root `apm.yml`, `core` and `all` list `statusline`; `node scripts/check-manifests.mjs` passes | A2 |
| A5 | `[PBI] chore: remove queue, review-fanout, verify-project, handoff and orch-pipeline` | M | the five skill directories under `packages/delivery/.apm/skills/` deleted; `test/packages/delivery/` keeps only `apm-install`, `issue-planning`, `retro` tests; `test/integration/queue/` deleted; `test/helpers/{queue-batch.ps1,classify-fixture.ts,pwsh-worker.ts}` deleted when no remaining test imports them; `docs/usage/herdr.md` and the queue's `references/harness-flags.md` deleted; `packages/delivery/.apm/prompts/` entries that start the queue or the orchestrator deleted; `packages/delivery/apm.yml` and root `apm.yml` updated | A2 |
| A6 | `[PBI] chore: remove orchestration state from github-issue` | M | deleted under `packages/github/.apm/skills/github-issue/`: `references/{pbi-pipeline,orchestrator-gates,loop-mode,next-selection,task-waves,model-policy,status}.md`, `templates/parked-gate.md`, `scripts/{Add-LedgerLine,Write-StatusTable,Get-ParkedRuling,Get-TaskWaves,New-Worktree,Remove-Worktree,Set-ParkedGate,Enter-Checkout,Exit-Checkout}.ps1`; `SKILL.md` keeps issue types, title prefix, hierarchy, conventional commits, sub-issues, task-issue format, standalone and batch workflows, release branches, and loses the orchestrator, ledger, lease, parked-gate and Final-Verify text; `references/batch-workflow.md` and `standalone-issue.md` no longer name `explorer`, `review-fanout` or the orchestrator (review = `code-review` skill once on the diff); their tests under `test/packages/github/` deleted; `CONTRIBUTING.md` public-surface table loses ledger, lease, worktree and marker rows | A2 |
| A7 | `[PBI] chore: remove the state directory from detect-techstack and implementation` | S | `Enable-Worktrees.ps1` and `state_dir` deleted from `detect-techstack` (script, `SKILL.md`, JSON report, tests); the `implementation` skill loses every reference to `<state>`, task reports and the ledger; `Format-Changed.ps1` stays; tests adjusted | A6 |
| A8 | `[PBI] chore: move github-project to GravionLabs/ci` | M | **Decision (default, change it before the PBI starts):** the interactive skill stays and ships from ci. `Set-ProjectStandard.ps1`, `Sync-ProjectNeeds.ps1`, `Set-Sprint.ps1`, their tests and `docs/usage/project-standard.md` move to `GravionLabs/ci` under `project/` next to the existing `project/needs` action; the skill `github-project` moves to `GravionLabs/ci/.apm/skills/github-project/` with a minimal `apm.yml` in ci (one skill, same name); `ci/project/needs/needs.sh` calls the local script instead of apm-hub at a pinned ref; the caller templates `issue-events.yml` and `project-needs.yml` move to ci; ci's CI runs the moved tests (pwsh and Node); apm-hub: the skill, scripts, tests and docs are deleted, `.github/workflows` drop the `In release` project step if it calls the moved script, `packages/github/apm.yml` and `README` updated with a link to ci. Two PRs: one in ci (first), one in apm-hub | A2 |
| A9 | `[PBI] chore: remove agent-write and agent-audit from apm-tooling` | S | the two skills and their tests deleted; `skill-write` rules lose the agent paragraphs; `packages/apm-tooling/apm.yml` updated | A3 |

#### [Feature] chore: retro and issue-planning without the ledger

| # | PBI | Size | Done when | Depends on |
|---|---|---|---|---|
| A10 | `[PBI] chore: retro skill loses Get-RunMetrics.ps1 and the ledger input` | S | `scripts/Get-RunMetrics.ps1` and `test/packages/delivery/run-metrics*.test.ts` deleted; `SKILL.md` states that metrics come from `dromos run metrics --format json` (contract filled in by P4) and keeps categories, report format and the "no issue without approval" rule; no reference to `<state>` or a ledger remains | A5 |
| A11 | `[PBI] chore: issue-planning loses publish.md and the state paths` | S | `references/publish.md` deleted (the runner publishes); `plan-schema.md` is the only output contract and names no file path; `grilling.md` is replaced by `questions.md`: every question carries `id`, `question`, `options[]`, `recommended` and `why`; `SKILL.md` and tests adjusted | A6 |

#### [Feature] chore: test suite, CI and docs after the cleanup

| # | PBI | Size | Done when | Depends on |
|---|---|---|---|---|
| A12 | `[PBI] chore: one vitest project, no perf project, no scripts-tests list` | S | `vitest.config.ts` has one project; `test/helpers/scripts-tests.ts`, `test/repo/vitest-projects.test.ts` and every `*.perf.test.ts` deleted; `package.json` scripts reduced to `build`, `test`, `test:watch`, `test:ci`; `scripts/related-tests.mjs` and `scripts/run-related-tests.mjs` deleted; `pnpm test` under 60 s on a laptop; `test-results/junit.xml` shows no file above 10 s | A3, A4, A5, A6, A7, A8, A9, A10, A11 |
| A13 | `[PBI] ci: single test job, no matrix` | S | `.github/workflows/ci.yml` runs build, test, manifest check and skill report once; the integration and perf matrix entries are gone; `test/integration/` (queue leftovers, `harness/`, `skills/`, its `package.json`) deleted; the Copilot harness stays available at tag `v2.5.4` for dromos B5 | A12 |
| A14 | `[PBI] docs: AGENTS.md, README, docs/ and site describe skills only` | M | `docs/orchestrator.md` replaced by `docs/runner.md` (one page: the runner lives in dromos, install, commands, link); `docs/working-mode.md` and `docs/usage/common-workflows.md` rewritten for interactive skills (section 6 of the work plan); `AGENTS.md` has no agents, queue, ledger, state or gate text, its package table matches the packages on disk; `site/` navigation updated; `scripts/New-AgentsMd.ps1` updated or deleted; `Get-SkillReport.ps1 -Root .` reports zero dangling references; `grep -rE "ledger|<state>|review-fanout|pbi-runner|orchestrator agent" docs AGENTS.md README.md packages` returns nothing except `docs/simplification-*.md` and the CHANGELOG | A13 |
| A15 | `[PBI] chore: release apm-hub 3.0.0` | S | `CHANGELOG.md` "Removed" section lists every package, skill, script and entry point removed in A3-A13; `CONTRIBUTING.md` deprecation table is emptied; release PR `release/next` → `main` with the `github-release` skill; a checklist in the PR body names every GravionLabs repository whose `apm.yml` references a removed package | A14 |

Stage A exit: `pnpm test` green and fast; `apm install` of `core` installs skills (plus the guardrails hook) only; nothing in apm-hub references `<state>`, a ledger, a lease, a worktree script, a gate or an agent.

---

## 2. Stage B: the runner in dromos, apm-hub adapted in parallel

Repository: `GravionLabs/dromos`. Target version 0.4.0 (milestones 0.2.0, 0.3.0, 0.4.0). Work on `release/next`, one PBI per PR, with the interactive skills until B10b; from then on dromos PBIs run through the runner itself.

The existing CLI has `dromos run export <issue>` (`src/cli/run.ts`, a pass-through subcommand in `src/cli/program.ts`); the new `run task|pbi|feature|epic` subcommands go into the same `run` command. The existing `src/state-machine.ts` models the old pull-model workflow (`implementation_submitted`, `gate_passed`); the runner gets its own state machine under `src/runner/` and the old one goes with B16.

### [Epic] feat: dromos runs the apm-hub workflow (runner, adapters, planning)

Done when: `dromos run epic <nr> --harness claude|copilot` plans missing PBIs and Tasks, implements approved PBIs in dependency order, opens PRs, never waits for a human, and writes one event per phase transition; the same commands work from a terminal and from the `/orchestrator` skill in Claude Code and Copilot.

#### [Feature] feat: decision record and roadmap re-scope (milestone 0.2.0)

| # | PBI | Size | Done when | Depends on |
|---|---|---|---|---|
| B1 | `[PBI] docs: decision record — dromos owns control flow, apm-hub is content` | S | dromos#131 gets a comment with the decision and is closed and the measurements from `simplification-plan.md` section 2 (link to the file on apm-hub `release/next`); `ROADMAP.md`: Stage 4 (Session API) rewritten as "harness adapters and runner", Stage 7 kept, Stage 3 pull-model tools marked for removal (B16); `README.md` architecture paragraph and diagram updated to "runner calls harness sessions; bus keeps events and metrics" | — |

#### [Feature] feat: harness adapters for Claude Code and Copilot CLI (milestone 0.2.0)

| # | PBI | Size | Done when | Depends on |
|---|---|---|---|---|
| B2 | `[PBI] feat: Harness interface, RunEvent schema and runner config` | M | `src/runner/harness.ts` defines `Harness.runPhase(input) → {result, events, usage}` as in plan section 3.4 (`prompt, cwd, model, skills, allow, schema, timeoutMs`), with Zod for the schema; `schema/events.schema.json` gains `phase.started`, `phase.finished`, `phase.failed` with `issue, runId, phase, harness {name, version, sdk}, model, durationMs, usage`; `src/runner/config.ts` loads `.dromos/config.json` from the target repository: `harness`, `models` per role (`planner`, `implementer`, `implementerRound2`, `reviewer`, `retro`), `skills` per role (default `planner`, `implementation`, `code-review`, `retro`), `test.related` (optional) and `test.full` commands (without `test.related` the runner uses `test.full`), `parallel` (default 3), `allow` extensions; defaults when the file is missing; unit tests for loading, defaults and validation errors | B1 |
| B3 | `[PBI] feat: permission callback with allowlist and git guardrails` | M | `src/runner/permissions.ts`: one allowlist (git, gh, pwsh, pnpm, npm, npx, node, dotnet, uv, python, ng subcommands) ported from apm-hub `packages/hooks/.apm/hooks/` `allowed-commands.ps1` at `v2.5.4`; git guardrails ported from the apm-hub git-guardrails hook (deny: force push to `main`/`release/*` except `release/next`, `reset --hard`, `clean -f`, `branch -D`, `checkout -- .`/`restore .`, remote delete of `main`/`release/*`); `Decision = {allow: true} or {allow: false, reason}`; config `allow` extends the list; every deny is a `permission.denied` event; table-driven tests with at least every guardrail case of the apm-hub hook tests | B2 |
| B6 | `[PBI] feat: spike command — implement one Task through the harness CLIs` | M | `src/runner/harness/cli.ts`: a minimal `Harness` for both clients on top of their headless CLIs (`claude -p --output-format json`, `copilot -p` with `--allow-tool` per allowlist entry); `dromos run task <nr> --harness claude|copilot [--repo <path>]`: creates a worktree, runs one implementer phase ("implement this Task and commit"), checks a new commit exists, writes the `phase.*` events; unit tests with a fake CLI binary on `PATH`; `docs/spike.md` describes how to run the measurement (B6b) | B2, B3 |
| B6b | `[PBI] chore: spike measurement and harness decision` | S | `dromos run task` run three times per harness against a throwaway repository; results (wall time, JSON validity, permission stalls, usage availability) recorded in `docs/spike.md`; decision recorded there and in dromos#131: Copilot via SDK (B5 as written), via the CLI adapter only, or Claude-only for 0.4.0; B5 is edited to match before it starts | B6 |
| B4 | `[PBI] feat: Claude adapter on the Claude Agent SDK` | M | `src/runner/harness/claude.ts` runs a phase with the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`, version pinned in `package.json`): model, permission callback from B3, skills directory, JSON output validated against the phase schema, one retry on invalid JSON with the validation error appended; the CLI adapter from B6 stays as fallback behind `harness: "claude-cli"`; version detection (`claude --version`, SDK package version) into the run header event; tests with recorded SDK message fixtures; one opt-in live test (`DROMOS_LIVE=claude`) | B6 |
| B5 | `[PBI] feat: Copilot adapter on @github/copilot-sdk` | M | `src/runner/harness/copilot.ts` with `CopilotClient`/`createSession` (inline custom agent, `onPermissionRequest` → B3 callback, `COPILOT_SKILLS_DIRS`, JSON requested in the prompt and validated, one retry); seed: `git -C ../apm-hub show v2.5.4:test/integration/harness/copilot-harness.ts`; SDK version pinned; usage from SDK events where available, else `null` (never estimated); version detection into the run header; tests with recorded event fixtures; opt-in live test (`DROMOS_LIVE=copilot`) | B6b |

#### [Feature] feat: PBI runner (milestone 0.3.0)

| # | PBI | Size | Done when | Depends on |
|---|---|---|---|---|
| B7 | `[PBI] feat: run state machine for one PBI with bounded rounds` | M | `src/runner/state-machine.ts`: `selected → implementing(round) → testing → reviewing → fixing(round) → testing → pr_opened`, any state → `blocked(reason)`; `maxFixRounds` default 1 from config; transitions are pure functions returning the next state plus the event to emit; unit tests for every transition and for the round limit, no I/O | B2 |
| B8 | `[PBI] feat: worktree, branch and PBI claim per run, GitHub access in one module` | M | `src/runner/git.ts`: worktree under `<repo>/.worktrees/<nr>`, branch `<type>/<nr>-<slug>` from the integration branch (`release/next` when it exists, else the default branch), cleanup on `pr_opened`, kept on `blocked`; `src/runner/github.ts` on top of the existing `src/github.ts`: issue read with sub-issues and blocked-by, labels, comments, PR create/update, draft PR; claim: label `in-progress` plus a comment with the run id, a PBI that carries the label is refused unless `--force`, the label is removed on `pr_opened` and `blocked`; all `gh` calls mocked in tests; no LLM phase ever calls `gh` (the allowlist from B3 denies `gh` inside phases) | B7 |
| B9 | `[PBI] feat: implementer phase with parallel Tasks and related tests` | M | Tasks without a blocked-by link between them run in parallel sessions (`Promise.all`, cap `parallel` from config); each Task gets a fresh context with the Task body, the PBI acceptance criteria and the `implementation` skill; a PBI without Tasks is one implementer phase; after all Tasks the runner runs `test.related` (else `test.full`); the result goes into the state machine and an event; red tests keep the failure tail (last 50 lines) for the PR body; no full suite inside the run when `test.related` exists; tests with a fake harness | B4, B7, B8 |
| B10 | `[PBI] feat: reviewer phase, one fix round, PR` | M | one reviewer session over the PBI diff (`git diff <base>...HEAD`) with the acceptance criteria and the `code-review` skill; output validated against `{blocking:[{file,line,title,why}], notes:[]}`; `blocking` non-empty → one fix round (implementer with the `implementerRound2` model and the findings) → tests again → PR; `notes` become one PR comment; red tests after the last round → draft PR; PR body: `Closes #<pbi>`, Task list with commit SHAs, `## Not delivered`, `## Review notes`, `## Test result`; tests with a fake harness and mocked `gh` | B9 |
| B11 | `[PBI] feat: dromos run pbi CLI, run header, --format json` | S | `dromos run pbi <nr> [--harness] [--repo] [--format text|json] [--dry-run] [--force]` as a subcommand of the existing `run` command; first line and first event is the run header (harness, versions, models per role); `--format json` streams events as JSON lines; `--dry-run` prints the steps without calling a harness or `gh` writes; exit codes 0 done, 1 blocked, 3 error; text output only on a TTY | B10 |
| B10b | `[PBI] chore: validate the PBI runner on real PBIs` | S | ten PBIs of apm-hub or dromos run end to end with `dromos run pbi --harness claude`, five with `--harness copilot` (or fewer per the B6b decision); each run's PR, duration and outcome listed in `docs/validation.md`; every runner defect found is an issue of its own | B11 |

#### [Feature] feat: Feature and Epic runs, planning without gates (milestone 0.3.0)

| # | PBI | Size | Done when | Depends on |
|---|---|---|---|---|
| B12 | `[PBI] feat: planner phase with questions as data` | M | planner session with the `planner` skill returns `{items[], questions[], assumptions[]}` validated against apm-hub `packages/delivery/.apm/skills/planner/schema/plan.schema.json` (copied into `schema/` with a sync test, until P1 lands use the shape in plan section 3.5 plus questions `{id, question, options[], recommended, why}`); the runner, not the LLM, creates the issues: PBIs under a Feature, Tasks under a PBI, `[Level]` title prefix, `Parent …: #N` first body line, native sub-issue links, blocked-by from `dependsOn`, label `needs-approval`; unit tests with mocked `gh` | B8 |
| B13 | `[PBI] feat: planner questions on a TTY and by flag` | S | on a TTY the runner asks each question as a select prompt, Enter = `recommended`; `--answer <id>=<value>` (repeatable) answers without a prompt; `--assume-recommended` takes every recommendation and writes the assumptions into the plan and into each created issue under `## Assumptions`; the unanswered-question count is a field of `phase.finished`; unit tests with a fake TTY | B12 |
| B13b | `[PBI] feat: headless planner questions as an issue comment` | S | without a TTY and without `--assume-recommended`: the draft plan and all questions go into one issue comment (one section per question with options and recommendation), label `needs-decision`, `attention` event, exit 2, no issues created; on the next run the runner reads answers from `/answer <id> <value>` comments of that issue, removes `needs-decision` and continues; unit tests with mocked `gh` | B13 |
| B14 | `[PBI] feat: dromos plan feature|pbi and dromos run feature|epic` | M | `dromos plan feature|pbi <nr>` runs B12/B13/B13b and stops; `dromos run feature|epic <nr>` plans missing children, then selects PBIs that are `approved`, open, unclaimed and not blocked by an open issue, in dependency order, and runs each as in B11; unapproved and blocked PBIs are skipped and listed in the final report; never waits for a human; Ctrl-C safe (state lives on GitHub, worktree kept, claim label removed) | B11, B13b |
| B15 | `[PBI] feat: dromos status <nr>` | S | status table from GitHub state for an Epic, Feature or PBI: children, labels (`needs-approval`, `approved`, `in-progress`, `needs-decision`), PR and its state, last run header from the events; `--format json`; replaces apm-hub `Write-StatusTable.ps1` | B14 |

#### [Feature] chore: remove the pull-model tools and bus-side leases (milestone 0.3.0)

| # | PBI | Size | Done when | Depends on |
|---|---|---|---|---|
| B16 | `[PBI] chore: remove the pull-model MCP tools and the old workflow state machine` | M | `src/tools/{submit,review,pr,runs,status}.ts` and their tests deleted; `src/tools/{messaging,inbox}.ts` stay only if code outside `src/tools/` or the herdr plugin references them (check with `grep -rn` and state the result in the PR), else deleted too; `src/state-machine.ts` (old pull model) and its tests deleted; `src/gate.ts` stays (command runner used by the runner's test step); `README.md` MCP section rewritten | B10 |
| B17 | `[PBI] chore: remove http-lease and run-lease` | S | `src/{http-lease,run-lease,lease}.ts` and tests deleted, their routes removed from `src/http.ts`; worktree ownership is the runner's (B8 claim); `src/state-dir.ts` kept only for the SQLite path | B16 |

### apm-hub, in parallel with Stage B

Repository: `GravionLabs/apm-hub`, version 3.1.0.

### [Epic] feat: apm-hub role skills and runner launcher (3.1.0)

Done when: the four role skills ship JSON schemas that dromos validates against, `/orchestrator` starts the runner from Claude Code and Copilot, the guardrails hook is gone, and 3.1.0 is released.

#### [Feature] feat: role skills with JSON contracts

| # | PBI | Size | Done when | Depends on |
|---|---|---|---|---|
| P1 | `[PBI] feat: planner skill — prompt and output schema` | M | `packages/delivery/.apm/skills/planner/` (renamed from `issue-planning`, old name removed, `CONTRIBUTING.md` rename table updated): `SKILL.md` ≤ 100 lines, `references/plan-schema.md` (items, questions with `id, question, options, recommended, why`, assumptions), `references/slicing.md`, `references/invariants.md` kept, `references/questions.md` from A11; `schema/plan.schema.json` (JSON Schema draft 2020-12) shipped so dromos validates against the same file; content test that the schema parses and that `plan-schema.md` names every top-level property | A11 |
| P2 | `[PBI] feat: implementer contract in the implementation skill` | M | `implementation` skill gains `references/runner-contract.md` (input: Task body, PBI criteria, worktree; rules: commit with `Refs #<task>`, never call `gh`, never push) and `schema/implementer.schema.json` (`status: done|blocked, commit, filesChanged[], testsRun, notes[]`); dispatch to `<lang>-implementation` unchanged; no state paths; content tests | A7 |
| P3 | `[PBI] feat: reviewer contract in the code-review skill` | M | `code-review` skill becomes the reviewer role: input diff plus acceptance criteria plus the `## Review rules` of the detected languages; output `schema/review.schema.json` (`blocking[{file,line,title,why}]`, `notes[]`); the 🔴/🟡/🟢 severity ladder is replaced by the blocking definition (breaks an acceptance criterion or is a correctness or security defect; everything else is a note); security is a section of the prompt; interactive use still prints a readable report; content tests | A5 |
| P4 | `[PBI] feat: retro skill reads dromos run metrics` | M | input `dromos run metrics --format json` (contract from dromos B19, linked); report format, categories and the approval rule unchanged; escalation lines come from `phase.finished` events; draft candidates name the skill file and the rule to change | A10, B19 |

#### [Feature] feat: launcher, install story and release

| # | PBI | Size | Done when | Depends on |
|---|---|---|---|---|
| P5 | `[PBI] feat: orchestrator launcher skill` | S | `packages/delivery/.apm/skills/orchestrator/SKILL.md`: `/orchestrator <plan|run|status> <nr> [--harness …]` runs `dromos … --format json`, summarizes progress in the session, on exit 2 asks the planner questions with the client's question tool and re-runs with `--answer`; no agent file; works on Claude Code and Copilot; content test; `docs/runner.md` updated | B11, B13b |
| P6 | `[PBI] docs: install story — apm install plus npm i -g dromos` | S | `README.md`, `docs/prerequisites.md`, `apm-install` skill (`references/after-install.md` names the runner install and `.dromos/config.json` with an example), `.github/skills/check-prerequisites` checks `dromos --version` | P5 |
| P9 | `[PBI] chore: remove the git-guardrails hook, dromos enforces the guardrails` | S | `packages/hooks/` and `test/packages/hooks/` deleted; root `apm.yml`, `core`, `all` no longer list `hooks`; `docs/usage/copilot-hooks.md` deleted; `AGENTS.md` and `README.md` say the guardrails live in the dromos permission callback (link) | B3 |
| P7 | `[PBI] feat: release apm-hub 3.1.0 with the role skills and launcher` | S | P1-P6 and P9 merged; `core` = `github`, `delivery` (planner, retro, orchestrator, apm-install), `shared`, `statusline`; `all` adds the stack packages; CHANGELOG; release PR with the `github-release` skill | P1, P2, P3, P4, P5, P6, P9 |

---

## 3. Stage C: metrics, learning loop, release

Repository: `GravionLabs/dromos`, milestone 0.4.0; replaces dromos Epic #159 (closed as superseded in the triage).

### [Epic] feat: self-learning loop on runner events

Done when: runner runs emit outcome events, `dromos run metrics` aggregates them across runs and repositories, the apm-hub retro reads them, dromos 0.4.0 is released and the first retro over runner runs is done.

#### [Feature] feat: outcome events, metrics and release (milestone 0.4.0)

| # | PBI | Size | Done when | Depends on |
|---|---|---|---|---|
| B18 | `[PBI] feat: outcome events — findings with fingerprints, test results, fix-round causes` | M | the reviewer and test steps emit `outcome.finding {fingerprint: sha1(file, rule, title), blocking, fixed}`, `outcome.tests {passed, failed, failures[]}`, `outcome.fixRound {cause}`; the planner emits `outcome.questions {count, assumed}`; `schema/events.schema.json` and tests | B10, B13b |
| B19 | `[PBI] feat: dromos run metrics on runner events` | M | `src/run-metrics.ts` computes per run and in aggregate: durations per phase, usage per role, fix rounds, blocked runs, unanswered questions, finding fingerprints repeated across runs; CLI `dromos run metrics [--issues <n,…>] [--since <date>] --format json|table` (replaces the closed #137 and #180; reuse what exists in `src/run-metrics*.ts`); `GET /runs/metrics` keeps its shape where possible; the JSON contract is documented in `docs/run-metrics.md` for apm-hub P4 | B18 |
| B20 | `[PBI] feat: cross-repo learning queries and approval notifications` | M | fingerprints and causes queryable across repositories (the closed dromos#161 has the original scope); the herdr plugin shows pending `needs-approval` and `needs-decision` issues as attention (the closed dromos#162, reduced to a notification) | B19 |
| B21 | `[PBI] feat: release dromos 0.4.0` | S | CHANGELOG, `npm i -g dromos` documented in `README.md`, `dromos --version` in the run header, apm-hub `check-prerequisites` passes against the published package | B15, B17, B19 |
| P8 | `[PBI] chore: first retro on ten runner runs` | S | apm-hub retro over the first ten `dromos run pbi` runs; the section 2 metrics of `simplification-plan.md` compared with the targets (human wait time per run ≈ 0, runs with red tests < 20 %, fix rounds < 0.5 per PBI, median active time per PBI ≤ 34 min); candidates become issues in the right repository after approval; this work plan gets a "Learned" section | P7, B21, B10b |

P8 lives in apm-hub and is a sub-issue of this dromos Epic.

---

## 4. Dependency graph (coarse)

```
A1 → A2 → {A3, A4, A5, A6, A8} → {A7, A9, A10, A11} → A12 → A13 → A14 → A15
B1 → B2 → B3 → B6 → B6b → B5
                     B6 → B4 → B9 ; B7 → B8 → B9 → B10 → B11 → B10b
                                       B8 → B12 → B13 → B13b → B14 → B15
                                               B10 → B16 → B17
A11 → P1 ; A7 → P2 ; A5 → P3 ; (A10, B19) → P4 ; (B11, B13b) → P5 → P6 ; B3 → P9 ; P1-P6, P9 → P7
(B10, B13b) → B18 → B19 → B20 ; (B15, B17, B19) → B21 ; (P7, B21, B10b) → P8
```

Parallel tracks: A3-A6 and A8 are independent of each other once A2 exists. B4 and B6b are independent. B7 can start right after B2. P1-P3 can start as soon as their Stage A dependency is merged, long before B10.

---

## 5. What is explicitly not done

- No port of review-fanout, advisory policies, advisory rounds, delta re-review or the mechanical classifier.
- No ledger, no `<state>` directory, no leases, no loop markers, no parked gates, no `/ruling` parser.
- No OpenCode adapter in 0.4.0 (the interface allows one later).
- No second-opinion review in 0.4.0.
- No dromos-mux work; it stays parked.
- No per-dispatch model escalation logic in prompts; the round-2 model is config.
- No full test suite inside a run when `test.related` is configured; CI owns it.

---

## 6. Working mode during the transition

From A3 until B10b there is no automated pipeline. The intended mode:

- Issues are written with `github-issue` (hierarchy, titles, sub-issues) and planned with `issue-planning` / `planner` interactively.
- Implementation happens in an interactive Claude Code or Copilot session (Sonnet is enough for every PBI without the label `interactive`) with `implementation` and the stack skills; the session runs `pnpm test` itself.
- Review: `code-review` skill on the diff, once, before the PR; the PR is the second review.
- PRs with `github-pull-request`, releases with `github-release`. Both stay unchanged.
- The git-guardrails hook stays installed until P9.
- Do not run `apm update` against apm-hub `release/next` in a session that still uses the old orchestrator; pin `v2.5.4` if it is needed.
- dromos PBIs from B10b on are run by the runner itself (dogfooding), with `--harness claude` first.

---

## 7. Issues

Created 2026-10-27. Every PBI body has Overview, Parent, Acceptance Criteria (the Done-when line split into checkboxes), Technical Notes (branch, commands, context, out of scope) and Definition of Done; size in the body. Blocked-by links are native, also across the two repositories.
