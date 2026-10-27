# Simplification plan: apm-hub and dromos

Status: approved, 2026-10-27 (review corrections applied the same day). Execution order and backlog: [simplification-workplan.md](simplification-workplan.md). Supersedes the direction of the 2026-10-25 analysis ("dromos + apm-hub: Analyse und selbstlernendes Agent-System") and the 2026-10-26 dromos re-scope (dromos#131) in one point: control flow moves out of prompts into dromos, and apm-hub becomes a content-only repository.

## 1. Goal

One self-learning agent workflow that plans Epics and Features into PBIs and Tasks, implements them, opens pull requests, and improves its own prompts and review rules from the outcomes. It runs on Claude Code and GitHub Copilot CLI. OpenCode is out of scope for now.

The goal does not change. What changes is where the control flow lives and how many moving parts it takes.

## 2. Why: what the data says

Measured on 2026-10-27 over 41 timestamped orchestrator ledgers (2026-10-22 to 2026-10-27), the GitHub PR and issue history, and the repository itself.

| Metric | Value |
|---|---|
| Active agent time per PBI (median) | 34 min (Oct 22-23) → 41 min (Oct 26-27), roughly flat |
| Human wait time across the 41 runs | ~118 h, against ~27 h of agent time |
| Runs with at least one red Final-Verify | 17 of 41; 8 of the last 13 |
| Fix rounds per PBI | 1.24; 54 % of the recent runs had a fix round although the review verdict was APPROVE |
| Subagent stops per run | 23 → 33 (pbi-runner polling adds 13-42 "Waiting for …" turns per run) |
| Test suite | 2,508 → 3,289 tests in five days; ~1,250 s CPU; the 15 slowest files take 37-89 s each and all spawn pwsh |
| Tests that cover the stack skills (the product) | 34 of 3,289 |
| Tests that cover orchestration machinery (hooks, delivery, github, agents) | ~2,700 |
| Prose rules the orchestrator must follow | agents package 149 → 544 lines since Oct 12, plus ~1,160 lines of references |
| PowerShell | 33 scripts, 5,857 lines |
| Median PR size | 31 LOC / 4 files (Oct 12) → 374 LOC / 12 files (Oct 26) |

Root cause: control flow is written in prose. A prompt is asked to execute phases, gates, retries, leases and ledger lines. Because prompts do that unreliably, scripts were added to make the prose safe, hooks to observe it, and tests to check prose, scripts and hooks. Every new rule pulls new scripts and tests behind it. The retro skill already states the principle that was not applied to the pipeline itself: "Mechanical mistakes get a check, never a prose rule."

Secondary causes that follow from the first:

- Gates block unattended runs for hours (plan gate per PBI, verify-red gate, advisory question). Parking landed on Oct 26 and only covers the loop.
- Final-Verify runs the full suite up to three times per PBI, in parallel with five reviewers and a second PBI runner, and fails under load. "Flaky under load, passes alone" is the most repeated ruling.
- The review produces more rework than defects: advisory-only fix rounds after APPROVE, each costing an implementer run, a full verify and a delta review.
- Four clients with different subagent capabilities forced parallel code paths (review-lead on Claude Code, inline review-fanout elsewhere; parallel PBI runners on Claude Code only; headless variants per client).

## 3. Target architecture

### 3.1 Split of responsibilities

| | apm-hub | dromos |
|---|---|---|
| Role | What the agents know | When and how they run |
| Content | Skills, phase prompts, per-language review rules, stack packages, retro analysis skill | Runner CLI, run state machine, harness adapters (Claude, Copilot), GitHub access, worktrees, permission callback with git guardrails, event history, metrics, attention, herdr plugin |
| State | None | SQLite for events and metrics; GitHub is the source of truth for issue state |
| Tests | Content checks (frontmatter, size, manifests), a few dozen | Unit tests with mocked `gh` and a mocked harness |

### 3.2 The runner

```
dromos run epic <nr> [--harness claude|copilot]
dromos run feature <nr>
dromos run pbi <nr>
dromos plan feature <nr>          # plan only, no implementation
dromos status <nr>
```

The runner is a program. It owns the order of steps; the harness supplies one flat LLM session per step.

1. **Read the hierarchy** (code, `gh api`): Features, PBIs, Tasks, states, blocked-by links.
2. **Plan where something is missing** (LLM): a Feature without PBIs gets one planner call that returns PBIs as JSON; a PBI without Tasks gets one planner call that returns Tasks. The runner creates the issues and sets the label `needs-approval`.
3. **Select the next PBI** (code): approved, open, unblocked, dependency order. Nothing selectable → stop with a status report.
4. **Implement the PBI** (code + LLM): claim the PBI (label `in-progress` plus a comment with the run id; a PBI that already carries the label is skipped unless `--force`), create worktree and branch; one implementer call per Task with a fresh context, independent Tasks in parallel (`Promise.all`); run the related tests; one reviewer call; at most one fix round for blocking findings; run the related tests again; open the PR with `gh`. Red tests → draft PR with the failure list, never a gate.
5. **Repeat from 3** until the Epic or Feature has no selectable PBI left. Write the run's events and metrics; the retro reads them.

Human touchpoints, exactly three, none of them blocking a run:

- **Plan approval** per Feature, asynchronous, by label (`approved`). The runner never waits for it; it skips unapproved PBIs and reports them.
- **Planner questions.** Every question carries options, a recommended answer and a reason. On a TTY the runner asks; headless it posts them as one issue comment with label `needs-decision` and moves on (or applies the recommendations with `--assume-recommended`).
- **The pull request.** Full CI runs there. Notes from the review and from a red related-test run are PR comments.

### 3.3 Run state machine

The existing `dromos/src/state-machine.ts` is the seed. Per PBI:

```
selected → implementing(round) → testing → reviewing → fixing(round) → testing → pr_opened
                                                      ↘ blocked (round limit, planner error, repeated harness failure)
```

Rounds are bounded in code (`maxRounds`, default 1 fix round). Every transition emits one event with `issue`, `runId`, `phase`, `model`, `durationMs`, `usage`, and a phase-specific payload (task id, test result, finding count, PR url).

### 3.4 Harness interface

```ts
export interface Harness {
  runPhase(input: {
    prompt: string;               // phase prompt from apm-hub, with issue/plan paths filled in
    cwd: string;                  // the worktree
    model: string;                // per phase, per harness (config)
    skills: string[];             // skill directories to expose
    allow: (tool: string, input: unknown) => Decision; // one allowlist + guardrails, in TypeScript
    schema: ZodSchema;            // the phase's output contract
    timeoutMs: number;
  }): Promise<{ result: unknown; events: RunEvent[]; usage: Usage | null }>;
}
```

Adapters:

| | Claude | Copilot |
|---|---|---|
| Transport | Claude Agent SDK (fallback: `claude -p --output-format json --agents <json>`) | `@github/copilot-sdk` (`CopilotClient`, `createSession`, `customAgents`, `sendAndWait`); already in `test/integration/harness` |
| Permissions | SDK permission callback / `allowedTools` | `onPermissionRequest` |
| Skills | skills directory | `COPILOT_SKILLS_DIRS` |
| Structured output | native JSON output | JSON requested in the prompt, validated by the runner, one retry |
| Usage | per-message usage from the SDK | from SDK events where available, else `null` (never estimated) |

The allowlist and the git guardrails exist once, in TypeScript, and apply to both harnesses. The Claude hooks package becomes unnecessary for this purpose.

### 3.5 Phase prompts and roles

Four roles, each a prompt plus the skills it needs, each returning JSON against a schema:

| Role | Input | Output | Default model |
|---|---|---|---|
| planner | issue body, parent context, codebase summary | `{items:[{title, body, criteria[], size, dependsOn[]}], questions[]}` | opus |
| implementer | one Task, acceptance criteria, `implementation` + `<lang>-implementation` skills | `{status, commit, filesChanged[], testsRun, notes[]}` | sonnet; opus on round 2 |
| reviewer | the PBI diff, the acceptance criteria, the language's `## Review rules` | `{blocking:[{file,line,title,why}], notes:[...]}` | sonnet (optionally a second pass with another model) |
| retro | run events of one or many runs | `{candidates:[{category, evidence, change}], lessons[]}` | opus |

The prompts live in apm-hub as skills so that they stay usable interactively in any client: `planner` (renamed from `issue-planning`), `implementation` (implementer role), `code-review` (reviewer role) and `retro`. Each ships its output schema under `schema/`. The runner maps role → skill in its configuration and loads the skill by name from the installed skills directory.

### 3.6 Self-learning loop

1. The runner writes structured outcome events: phase durations, usage, test results, review findings with fingerprints (file, rule, title hash), fix-round causes, planner question counts.
2. `dromos run metrics` and `GET /runs/metrics` aggregate them (exists today for ledger-fed events).
3. The retro skill reads the aggregate, names the candidates with evidence, and proposes concrete changes: a review rule added to or removed from a `<lang>-implementation` skill, a prompt sentence, a model tier change.
4. Approved candidates become PRs against apm-hub (prompt or rule changes) or against the target repository (project-local lessons). The Stage C Epic of the work plan (successor of dromos#159) covers the cross-repo part; it needs no hook, no ledger, no regex.

Learning targets, in order of value: review rules per language (recurring findings become rules or checks), planner slicing (Tasks that needed two rounds were too large), model tiers per phase (escalation rate), prompts (repeated planner questions mean a missing input).

## 4. Do we still need agents?

Not as a product, and not as a distribution format.

What an agent file provides today: a name, a model, a tool set, a body of 40 lines, plus a `metadata` block that `apmw sanitize` resolves per client. The runner supplies all of this inline: the role prompt comes from a skill, the model and the tool policy come from runner configuration, and both SDKs take agents as inline JSON. Nothing has to be installed into `~/.claude/agents` or `~/.copilot/agents`, so `apmw sanitize`, the agent-frontmatter standard, `agent-write`, `agent-audit`, the goldens in apmw and the SessionStart sanitize hook all disappear.

What disappears with them is exactly the set of client differences that caused the parallel code paths: nested subagents, resumable subagents, the question tool inside a subagent, parallel `Agent` calls, `SubagentStop` payloads. The runner needs none of these. It calls a flat session per phase and does parallelism itself.

What remains:

- **Roles** (planner, implementer, reviewer, retro): prompts with a model and a tool policy. These are configuration of the runner, not agents a user installs.
- **One thin skill** `/orchestrator` (or `/run`) that starts the runner from inside an interactive Claude Code or Copilot session and streams its log into the conversation. It is the interactive entry point and the only thing that looks like an agent to the user.

If, later, a phase genuinely needs an agent that reasons across many turns with its own tools (for example an exploratory debugging phase), it is one more role in the runner configuration, still a flat session.

## 5. Why review-fanout is not a good idea

The idea was: five specialist reviewers (correctness, tests, spec, security, conventions) in parallel find more than one generalist. The ledgers and the code say otherwise.

1. **The dimensions overlap, so the system needs a second system to reconcile them.** The same HIGH finding is raised by two or three dimensions ("raised by both correctness and spec" appears in the ledgers), so review-lead must dedupe. A HIGH must then be verified by yet another reviewer dispatch. Then a mechanical classifier (`Classify-Diff.ps1`, 408 lines), a package filter, size classes, `rulings.json` suppression and a delta re-review were added to keep the output manageable. The machinery around the review is larger than the review.

2. **Five reviewers each prompted to find something in their dimension will each find something.** The result is a steady stream of MEDIUM and LOW advisories. In the measured runs, blocking findings are rare and sometimes refuted on verification, while advisories are plentiful. Advisories then drive the costly part: 54 % of recent runs had a fix round after an APPROVE verdict, each with an implementer run, a full verify (2.5 min, flake-prone) and a delta review. The review creates work instead of catching defects.

3. **It multiplies tokens without multiplying recall.** Each of the five contexts loads the full diff package (up to ~38k tokens in the measured runs). A single reviewer with the whole diff, the acceptance criteria and the language's review rules sees the same code once. The marginal recall of a fifth dimension does not justify five times the input.

4. **Coordination is a prompt problem again.** review-lead polls: 8-20 "still waiting on correctness and security" turns per review in the ledgers. On Copilot it never worked, because nested subagents are not available, so the inline fallback kept a second code path alive.

5. **The quality levers are elsewhere.** Mechanical issues (formatting, lint, type errors, missing tests) are caught by deterministic checks in the runner, not by a conventions reviewer. Semantic issues are caught by one reviewer with full context. Spec compliance is best checked against acceptance criteria the planner wrote as testable statements. Independence, if wanted, comes from running the same review prompt with a second model and comparing, which is cheaper and more independent than splitting one model's attention into five prompts.

Replacement: one reviewer call with one prompt, output `{blocking, notes}`. `blocking` means "breaks an acceptance criterion or is a correctness defect"; at most one fix round for it. `notes` become PR comments and feed the retro. Security stays in the prompt as a section, not as a separate reviewer. Nothing is suppressed, deduped or classified by a second process.

## 6. Test strategy

A simpler workflow leads to simpler tests for three reasons: control flow in TypeScript is tested with mocked `gh` and a mocked harness (no pwsh spawn, no git fixtures, no timeouts); the ledger, leases, markers and hooks have no tests because they no longer exist; without process spawns there are no load flakes, so the main source of red verifies disappears with the suite that produced it.

| Repository | Today | Target |
|---|---|---|
| apm-hub | 3,289 tests, ~21 CPU min, 4 vitest projects | ~50-100 content checks (frontmatter, size, manifest, prompt schema compatibility) plus the existing stack-skill tests; one vitest project, seconds |
| dromos | 33 test files | runner unit tests (state machine, selection, permission callback, adapters with recorded SDK fixtures), ~300-500 cases; one opt-in live test per harness against a throwaway repository |

Perf and flake-sensitive tests are deleted, not moved.

## 7. Migration plan

No rewrite of the stack skills. **The order of execution is the one of [simplification-workplan.md](simplification-workplan.md): Stage A cleans apm-hub first, Stage B builds the runner, Stage C adds metrics and the releases.** The stages below describe the content of the work; their numbering is historical and is not the order. In particular the deletions of Stage 5 happen first (workplan Stage A), with three exceptions that stay until their replacement exists: the git-guardrails hook (until dromos ports it), the Copilot SDK harness (until it is copied to dromos) and the last 2.x release as a pin for the old pipeline.

### Stage 0: Freeze (apm-hub, immediately)

- No new pipeline features in apm-hub (`agents`, `hooks`, `queue`, ledger scripts, gates, loop, next-selection). Bug fixes only.
- Close or label `superseded` the roadmap items that bind the ledger to the bus: #390, #398, #577, #591, #592, and the parked-gate follow-ups.
- Record the decision in dromos#131 (reversal of the 2026-10-26 re-scope: dromos owns control flow; apm-hub is content).

### Stage 1: Spike (dromos, 1-2 days)

- `dromos run task <nr> --harness claude|copilot`: one phase, "implement this Task and commit", on the existing state machine.
- Measure per harness: wall time, JSON validity rate, permission behavior headless, usage availability.
- Exit criterion: both adapters complete three Tasks in a throwaway repository without a manual step. If the Copilot SDK (0.1.x) cannot, decide between waiting, the CLI fallback (`copilot -p`), or Claude-only for the first release.

### Stage 2: PBI runner (dromos)

- `dromos run pbi <nr>`: worktree, Tasks in parallel, related tests, one reviewer call, one fix round, PR. State machine transitions and events as in 3.3.
- Permission callback with the git guardrails (ported from the hooks package, tested in TypeScript).
- Phase prompts in the apm-hub skills `planner`, `implementation`, `code-review`, `retro` with JSON schemas; the runner loads them by name.
- Exit criterion: ten PBIs of apm-hub itself run end to end on Claude; five on Copilot.

### Stage 3: Feature and Epic runs (dromos)

- `dromos plan feature <nr>`, `dromos run feature|epic <nr>`: planner calls, issue creation, `needs-approval`/`approved` labels, selection in dependency order, never blocking.
- `dromos status <nr>`: the status table from GitHub state (replaces `Write-StatusTable.ps1`).
- Attention becomes notification only (herdr plugin shows where approval is pending).

### Stage 4: Metrics and retro (both)

- Runner events feed `run-metrics`; `dromos run metrics` replaces `Get-RunMetrics.ps1`.
- The retro skill reads `GET /runs/metrics` JSON; its output format stays (candidates with evidence, draft PBIs).
- Outcome events with finding fingerprints (dromos#160) are emitted by the reviewer phase directly.

### Stage 5: Delete (apm-hub, dromos)

apm-hub, delete:

- `packages/agents` (nine agent files, orchestrator skill), `packages/hooks` (ledger hook, context warning, guardrails, sanitize; statusline moves to its own small package or is dropped), `packages/delivery/.apm/skills/queue`, `review-fanout`, `verify-project` (the runner runs tests), `handoff`, `orch-pipeline`.
- In `github-issue`: all ledger, lease, worktree, parked-gate, loop, next-selection, task-wave and gate references and scripts. Keep: issue hierarchy, title convention, conventional commits, sub-issue linking, release branches.
- `github-project` (project standard, sprints, Needs sync): moves to `GravionLabs/ci/project/`, next to the reusable workflows and the `project/needs` action that already live there (workplan A8). It is not part of the goal.
- `test/packages/{agents,hooks,delivery,github}` except content checks; `test/integration/queue`; the perf project; `test/helpers/{pwsh-worker,classify-fixture,queue-batch,scripts-tests}`.
- `docs/orchestrator.md` is replaced by a short `docs/runner.md` that points to dromos.
- apmw: the sanitize path and the agent goldens.

dromos, delete or demote:

- `src/tools/{submit,review,pr,runs,status}` (the pull-model MCP tools where the agent calls the bus). Keep `post`, `ack`, `inbox` only if the herdr plugin uses them.
- The bus-side lease for apm-hub (`http-lease`, `run-lease`) once the runner owns worktrees.
- `dromos-mux` stays parked.

### Stage 6: Release

- apm-hub 3.0.0: content-only. `/orch`, `/orchestrator`, agents and hooks removed; `core` and `all` meta-packages redefined (skills only).
- dromos 0.4.0 (milestones 0.2.0 adapters, 0.3.0 runner, 0.4.0 learning loop; the earlier roadmap's milestones were closed as `(old roadmap)`): runner, adapters, metrics, status.
- Install story: `apm install` (skills) plus `npm i -g dromos` (runner). The queue launcher and `Install-QueueLauncher.ps1` disappear.

## 8. What stays as it is

- The issue hierarchy Epic → Feature → PBI → Task, the `[Level]` title prefix, conventional commits, `Refs #<task>` in Task commits, `Closes #<pbi>` in the PR body, the rolling `release/next` branch and the release PR into `main`.
- The stack packages (`ts`, `py`, `dotnet`, `rust`, `ng`) and their `<lang>-implementation` / `<lang>-test` skills with `## Review rules`. They are the product and the main target of the learning loop.
- Skills as the portability layer: `SKILL.md` loads unchanged on Claude Code and Copilot.
- The herdr plugin as the place where a human sees runs and pending approvals.

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Copilot SDK 0.1.x is immature; headless permissions may require `--allow-all-tools` | Stage 1 spike decides; CLI fallback adapter; Claude-only first release if needed |
| dromos is at v0.1.2 and becomes the critical path | Stage 1-2 run against apm-hub itself; stabilize before Stage 3; no herdr or mux work until Stage 3 is done |
| Loss of fine-grained interactive gates | The PR is the review point; `dromos status` and the herdr plugin show pending approvals; draft PRs carry failures |
| Non-Claude models behind Copilot return invalid JSON | Schema validation plus one retry; phase fails to `blocked` with the raw output attached, never a silent guess |
| A reversed architecture decision two days after the last one | Decision record in dromos#131 with the measurements of section 2; the retro reads this document before proposing pipeline changes |
| Features in flight on `release/next` touch files that Stage 5 deletes | Stage 0 freeze; finish or close in-flight PBIs before Stage 2 |
| No automated pipeline between the cleanup and the first `dromos run pbi` | Interactive skills (workplan section 6); the old pipeline stays installable by pinning apm-hub `v2.5.4` |
| Interactive sessions lose the git guardrails when the hooks package goes | The guardrails hook stays in apm-hub until dromos B3 ports it; removed afterwards (workplan P9) |
| Two runs pick the same PBI once the leases are gone | Claim by label `in-progress` with the run id (workplan B8); `--force` to override |

## 10. Open questions

1. Decided: one npm package `dromos`, the runner is a subcommand.
2. Decided: `.dromos/config.json` in the target repository, schema in dromos (workplan B2). Without `test.related` the runner runs `test.full`.
3. Decided: the planner returns JSON, the runner publishes; the LLM never calls `gh` (workplan B12).
4. Decided 2026-10-27: `github-project` moves to `GravionLabs/ci`. Inside A8 the default is to keep the interactive skill (minimal `apm.yml` in ci); the alternative (`workflow_dispatch` workflow) is a decision before A8 starts, not in its PR.
5. Decided: no second-opinion review in the first release; a later flag if the retro shows missed defects.

## 11. Decision summary

- Control flow lives in code (dromos), not in prompts (apm-hub).
- apm-hub ships skills and prompts only; no agents, no hooks, no scripts for orchestration state.
- GitHub is the only persistent state for issues; dromos keeps events and metrics; the runner is stateless per phase.
- Two human touchpoints: plan approval by label and the pull request. A run never waits for a human.
- One reviewer call, one fix round, notes to the PR. No review fanout, no advisory rounds.
- Related tests inside the run; the full suite runs in CI on the PR.
- Both harnesses behind one adapter interface; parallelism and permissions in the runner.
