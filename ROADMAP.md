# Roadmap

## Superseded by simplification-plan.md

As of 2026-10-27 this roadmap is frozen. The [simplification plan](docs/simplification-plan.md) replaces it, and the [simplification work plan](docs/simplification-workplan.md) sets the order of work: apm-hub becomes a content-only repository (3.0.0) and the control flow moves to dromos. The sections below are kept as history only. The following roadmap items are removed; merged work stays on `release/next` until Stage A deletes it, and the rest was closed as not planned:

| Epic | Features |
| --- | --- |
| #300 Orchestrator: smaller per-PBI footprint and multi-PBI sessions | #301, #302, #547 |
| #384 Orchestrator: extensions | #248, #385, #432, #455, #457, #478, #479, #499, #568 (and PBI #566) |
| #387 Report orchestrator state to dromos for dromos-mux | #388, #390, #398 |
| #573 Unattended orchestrator loops with a retro feedback loop | #574, #575, #576, #577, #595 |

Feature #661 (lessons contract) under Epic #573 stays open in the backlog.

Order of work and release assignment for the open issues. Created 2026-10-18, last release `v2.4.0` (2026-10-24), updated 2026-10-25 for Epic #573 (unattended loops, see the analysis document "dromos + apm-hub: Analyse und selbstlernendes Agent-System") and for Feature #595 (project cockpit, pulled into 2.5.0). Checked against GitHub state on 2026-10-25 (`v2.4.0` shipped #389 and Feature #388; the Rust Feature #412 and #571 are merged). Each release has a GitHub milestone of the same name. Work runs one PBI at a time on `release/next` (several PBIs edit `orchestrator.agent.md` or the ledger hook).

## Unattended path — self-learning workflow (Epic #573)

Overview across releases. The per-release tables below stay the order of work. Two human review points remain by design: planning (Epic → Feature → PBI → Tasks) and the release PR `release/next` → `main`. dromos blocks nothing up to step 5; counterpart: `GravionLabs/dromos` `ROADMAP.md`, Stage 2b.

| Step | Feature | PBIs in order | Release | Done when |
| --- | --- | --- | --- | --- |
| 0 | #595 project cockpit (Epic #384) | #597 → #598; #626 follows | 2.5.0 (#626: 2.6.0) | `Needs` is computed from GitHub state and shown by `status` and `queue -DryRun` |
| 1 | #574 unattended gates | #578 → #579 → #580 → #581 | 2.6.0 | a gate parks one PBI and the loop continues; `/ruling` answers it |
| 2 | #575 auto-merge | #582 → #583 → #585, #584 after #582 | 2.6.0 | merge by default, `release/**` carries required checks, docs name the two review points |
| 3 | #576 retro, stage 0 | #586 → #587 → #590 → #588 → #589, #594 parallel to #587–#589 | 2.7.0 | a retro runs after every loop, bounded by `Test-RetroScope.ps1`, and files candidate PBIs with hypothesis and metric |
| 4 | #390 attention, queue, usage | #391, #392, #393 → #394 | 2.7.0 | parked gates reach dromos as `attention`; serial with #588 (queue runner) |
| 5 | #577 retro reads the dromos history | #591 → #592 | 2.8.0 | cross-harness metrics; needs dromos 0.2.0 |
| 6 | #398 queue runner as driver | planned after dromos#65 | 2.8.0 | overnight Epic runs on the bus session API |

Rules for this path:

- No unattended run in this repository before #582 and #583 are both merged; until then run with `--no-merge`.
- #590 before #588: the first automatic retro is already bounded.
- `Needs` rules: `needs-decision` (parked gates, retro candidates) → `Decision` and `needs-review` → `Review` are in #597. A finished Feature or Epic (`FEATURE_DONE`, #584) needs its own rule in `Sync-ProjectNeeds.ps1`, added with #584.
- First acceptance run: one small Feature with `queue -Feature <nr>` overnight, ending with a list of parked PBIs and a release PR.

## 2.4.0 — Feature runs and hardening (released as `v2.4.0`)

| Order | Issue | Title | Size | Note |
| --- | --- | --- | --- | --- |
| 1 | #375 | loop-mode ledger lines before the PBI branch exists | S | merged; before #402 and #389: same hook file |
| 2 | #402 | worktree-shared state directory (git common dir, `DROMOS_STATE_DIR`) | L | Tasks #403–#410; after #375 (same hook files), before #386 and #389, which build on the path; #379 is already merged, so `Write-StatusTable.ps1` is adapted in #403; `.agents/` → `.dromos/` stays at 3.0.0 (dromos#70); client verification follow-ups (Windows #422, VS Code Copilot #423, OpenCode #424, Copilot CLI #425, Claude Code #450) are linked from the results table in docs/orchestrator.md; #410 stays open until they are done; Feature #432 (#422–#426) is not part of this release |
| 3 | #367 | git-guardrails scanner quadratic on bash 3.2 | S | independent |
| 4 | #252 | `github-release` refuses an already released branch | S | protects this very release; do before cutting |
| 5 | #251 | model policy, opus in `plan.json`, escalation at fix round 2 | M | released |
| 6 | #389 | `SubagentStop` hook sends `progress` to `$DROMOS_URL/ingest` (Feature #388, closed) | M | released; opt-in through `DROMOS_URL`, needs `POST /ingest` (dromos#43, in dromos `v0.1.0`) |

Feature #248 is closed; its verification follow-ups #422–#425, #450 belong to Feature #432. Epic #300 closes with Feature #547 (merged, ships in 2.5.0).

## 2.5.0 — Epic #384 (format, review convergence) and Feature #595: project cockpit

Merged on `release/next` (project status `In release`); the release is cut once the cockpit PBIs below are merged:

| Issue | Title | Note |
| --- | --- | --- |
| #442 | worktrees on demand under `.worktrees/<nr>`, checkout lease, queue wiring | Tasks #443 #444 #465 #445 |
| #383, #386 | format changed sources as a fixed implementer step, per-project override in `.agents/format.json` | Feature #385 closes |
| #480, #481, #482, #534, #535 | review rounds converge after APPROVE, smaller review package, fewer dimensions for small diffs | Feature #478 stays open with the unscheduled #487, #541, #543 |
| #548 | Task bodies cached as `task-<nr>.md` | Feature #547 closes |
| #569, #570, #571 | test files split per describe, perf cases in their own Vitest project | Feature #568 closes with #610 |
| #426 | bash tool for `pr-writer`, `review-lead`, `reviewer` on OpenCode | Feature #432 stays open |
| #610 | Final-Verify runs the full test suite once | Feature #568 closes |

The cockpit replaces the sprint as the way to pick work: a project field `Needs` (`Planning`, `Decision`, `Review`, `Blocked`, `Ready`, `In progress`, `Release review`) computed from GitHub state, and the views `Needs me`, `Ready for loop` and `Blocked` on it. The `Sprint` field stays optional. Pulled forward from 2.6.0 because the unattended loops of Epic #573 need the human's two jobs (planning, release review) visible first.

| Order | Issue | Title | Size | Depends on |
| --- | --- | --- | --- | --- |
| 1 | #596 | project standard: field `Needs`, views `Needs me`, `Ready for loop`, `Blocked`, `Sprint next`; label `planned` on publish | S | — |
| 2 | #597 | `Sync-ProjectNeeds.ps1`: rules, `Set-ProjectStandard -Sync`, loop and queue call at PBI boundaries, workflow `project-needs.yml` | M | #596 |
| 3 | #598 | `Needs` column in `orchestrator status` and `queue -DryRun`, closing `Needs me:` line | S | #597 |

Feature #595 closes with #598. The sync hooks in `add-to-project.yml` and `release-pr.yml` and the workflow template for other repositories are split out as #626 (2.6.0). #597 edits `loop-mode.md` and the queue runner before #579 and #582 do, so no parallel work on those files in this release.

### 2.5.0 — Epic #411, Feature #412: Rust stack package with Tauri (done: #412 and #414–#417 are closed)

| Order | Issue | Title | Size | Depends on |
| --- | --- | --- | --- | --- |
| 1 | #414 | ROADMAP.md schedules Epic #411 | S | — |
| 2 | #415 | `detect-techstack` detects Rust and Tauri | S | — |
| 3 | #416 | `rust` package with `rust-implementation` and `rust-test` | M | #415 |
| 4 | #417 | Tauri conventions in `rust-implementation` | S | #416 |

Feature #412 closes with #417. The stack PBIs share no files with the orchestrator PBIs of this release (`detect-techstack`, new `packages/<lang>/`, README and AGENTS.md tables) and may run in parallel to #383 and #386.

## 2.6.0 — Epic #573, Features #574 and #575: unattended loops (apm-hub only)

The loop and the queue run a Feature or Epic without a human by default. Two human review points remain: planning (`orchestrator plan <feature>` ends with the Task breakdown, #580) and the release PR `release/next` → `main`. No dromos dependency; these PBIs share files with #391/#392 (`pbi-runner`, queue runner), which follow in 2.7.0.

| Order | Issue | Title | Size | Depends on |
| --- | --- | --- | --- | --- |
| 1 | #578 | default advisory policy `medium` for headless runs | S | — |
| 2 | #579 | parked gates: label, comment, `attention`, loop reselection, queue exit codes | L | #578 |
| 3 | #580 | planning ends with Tasks: `plan <feature>` breaks approved PBIs down, `status` shows `unplanned` | M | #579 |
| 4 | #581 | `/ruling` issue comments answer parked gates | M | #579 |
| 5 | #582 | `Merge-ApprovedPr.ps1`: loop and queue merge approved PBI PRs by default, `--no-merge` | M | — (parallel to #578–#581: own script, queue runner shared with #579, so serial with it) |
| 6 | #583 | required checks on `release/**` as a verified merge precondition, `github-release protect` | S | #582 |
| 7 | #584 | Feature/Epic digest, `attention FEATURE_DONE`, `--release-at` | M | #582 |
| 8 | #585 | docs: unattended mode, review points, rollback | S | #582, #579 |

Feature #574 closes with #581, Feature #575 with #585. Before the first unattended run of this repository: #583 protects `release/next` (today it has no required checks).

### 2.6.0 — Feature #595 follow-up and PBIs moved out of 2.5.0

| Order | Issue | Title | Size | Depends on |
| --- | --- | --- | --- | --- |
| 1 | #626 | `Needs` sync from `add-to-project.yml` and `release-pr.yml`; workflow template for other repositories | S | #597 |

### 2.6.0 — Epic #411, Feature #413: Go, JVM and Swift packages, frontend detection

| Order | Issue | Title | Size | Depends on |
| --- | --- | --- | --- | --- |
| 1 | #418 | `detect-techstack` reports react, vue, svelte and next as frameworks | S | #415 (serial edits of `detect-techstack`) |
| 2 | #419 | `go` package, detection via `go.mod` | M | #418 |
| 3 | #420 | `jvm` package for Java and Kotlin, detection via build files | M | #419; `needs-decision`: one `jvm` package or `java` + `kotlin` |
| 4 | #421 | `swift` package, detection via `Package.swift` | M | #420 |

Feature #413 closes with #421, Epic #411 with it. These PBIs share no files with #578–#585 and #626 and may run in parallel to them.

## 2.7.0 — Epic #573, Feature #576: retro as a feedback loop (Stage 0)

| Order | Issue | Title | Size | Depends on |
| --- | --- | --- | --- | --- |
| 1 | #586 | `Get-RunMetrics.ps1` across runs (`-Loop`, `-Issues`, `-Since`), normalised rulings | M | — |
| 2 | #587 | headless retro: report under `<state>/retro/`, candidate PBIs (`retro`, `needs-decision`) with hypothesis and metric | L | #586 |
| 3 | #590 | retro guardrails: `guardrails.md`, `Test-RetroScope.ps1` in review and CI | M | #587 |
| 4 | #588 | retro trigger from loop and queue (`--retro auto|never`, thresholds) | M | #587; serial with #392 (queue runner) |
| 5 | #589 | hypothesis check after k runs, revert candidates | M | #587, #588 |
| 6 | #594 | planner estimates (size, tier) on the Task ledger line; retro measures their accuracy | M | #586 (parallel to #587–#589) |

Feature #576 closes with #589 and #594. #590 runs before #588 so the first automatic retro is already bounded.

### 2.7.0 — Feature #390: attention, queue, usage, `/dromos-mux`

| Order | Issue | Title | Size | Depends on |
| --- | --- | --- | --- | --- |
| 1 | #391 | `pbi-runner` `GATE|BLOCKED|FAILED` as `attention` | S | #389 (released in 2.4.0); #579 adds `kind: GATE` with question and options, dromos#138 returns the attention id |
| 2 | #392 | queue runner reports `queue.item`, supports `-Mux` | M | #389 (released in 2.4.0); serial with #588 (queue runner) |
| 3 | #393 | status line reports `usage` | S | #389 (released in 2.4.0) |
| 4 | #394 | user-invoked `/dromos-mux` skill in `delivery` | M | #392, dromos-mux released |

Epic #387 closes with #394.

## 2.8.0 — Features #577 and #398: the bus as history and executor (dromos-dependent)

### 2.8.0 — Epic #573, Feature #577: retro reads the dromos event history (Stage 1)

| Order | Issue | Title | Size | Depends on |
| --- | --- | --- | --- | --- |
| 1 | #591 | `Add-LedgerLine.ps1` posts every ledger line to `/ingest` as `progress` with `data.kind` | S | #389; dromos#136 for `kind` (omitted until released) |
| 2 | #592 | `Get-RunMetrics.ps1 -Source dromos` | M | #591, #586; dromos#135, dromos#137, #393 |

Counterpart: dromos Epic GravionLabs/dromos#132 (Features #133 history and metrics, #134 attention lifecycle; milestone 0.2.0 there).

### 2.8.0 — Feature #398: queue runner as driver on the bus session API

Scheduled for 2.8.0, planned when dromos#65 is released. Splits `Invoke-OrchestratorQueue.ps1` into driver (stays in apm-hub) and executor (bus session API, `GravionLabs/dromos` Feature #61); #392's `-Mux` is reworked into it. Order in dromos: `ROADMAP.md` there, stage 4.

| Needs from dromos | Enables in apm-hub |
| --- | --- |
| #62–#65 (headless sessions, restart, HTTP) | executor choice in the queue runner, overnight Epic runs without dromos-mux |
| #66–#68 (idle, pane mode) | `-Mux` as pane executor, following a run in dromos-mux |
| #43 (`/ingest`) | already needed for 2.6.0 (#389) |

PBIs for #398 are planned when #65 is released (`orchestrator plan 398`).

## 3.0.0 — breaking

| Issue | Title | Depends on |
| --- | --- | --- |
| #280 | remove `orch-pipeline`, `/orch` prompt and `.orch/` mentions | everything above released in 2.x |
| #431 | remove deprecated surface, incl. the queue alias `-MergeApproved` (default since #582) and the headless advisory `Gate:` (replaced by the default policy of #578) | #582, #578 released |

## Risks

- Unattended merges into `release/next` (#582) land before a human looks at them; the release PR is the review point, `release/**` must carry required checks (#583) before the default is switched on in a repository.
- The retro loop (#576) learns from ledger discipline; estimates from transcripts are ±30 %, measured cost arrives only with #393 and #592.

- #398 depends on the session API in dromos#61; until then the local executor stays the only one.
- 2.6.0 has no dromos dependency any more (#389 shipped in 2.4.0). Feature #390 (2.7.0) needs dromos#138 and dromos-mux, 2.8.0 needs dromos 0.2.0 and 0.4.0; if dromos lags, those move, nothing else does.
- The `merged` label was set by automation on Epic #573 and the unmerged #594 (2026-10-25 04:22 UTC, both removed by hand); the label step of the release workflow matches issue numbers in PR bodies too loosely.
