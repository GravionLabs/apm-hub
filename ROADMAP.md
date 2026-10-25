# Roadmap

Order of work and release assignment for the open issues. Created 2026-10-18, last release `v2.4.0` (2026-10-24), updated 2026-10-25 for Epic #573 (unattended loops, see the analysis document "dromos + apm-hub: Analyse und selbstlernendes Agent-System"). Each release has a GitHub milestone of the same name. Work runs one PBI at a time on `release/next` (several PBIs edit `orchestrator.agent.md` or the ledger hook).

## 2.4.0 — Feature runs and hardening (released as `v2.4.0`; only Feature #248 is still open and closes with its verification follow-ups)

| Order | Issue | Title | Size | Note |
| --- | --- | --- | --- | --- |
| 1 | #375 | loop-mode ledger lines before the PBI branch exists | S | merged; before #402 and #389: same hook file |
| 2 | #402 | worktree-shared state directory (git common dir, `DROMOS_STATE_DIR`) | L | Tasks #403–#410; after #375 (same hook files), before #386 and #389, which build on the path; #379 is already merged, so `Write-StatusTable.ps1` is adapted in #403; `.agents/` → `.dromos/` stays at 3.0.0 (dromos#70); client verification follow-ups (Windows #422, VS Code Copilot #423, OpenCode #424, Copilot CLI #425, Claude Code #450) are linked from the results table in docs/orchestrator.md; #410 stays open until they are done; Feature #432 (#422–#426) is not part of this release |
| 3 | #367 | git-guardrails scanner quadratic on bash 3.2 | S | independent |
| 4 | #252 | `github-release` refuses an already released branch | S | protects this very release; do before cutting |
| 5 | #251 | model policy, opus in `plan.json`, escalation at fix round 2 | M | `needs-decision`: decide first, otherwise it moves to 2.5.0 |

Closing: Feature #248 and Epic #300 once #402 and #251 are merged. Then `github-release` finish.

## 2.5.0 — Epic #384: format changed sources

| Order | Issue | Title | Size | Depends on |
| --- | --- | --- | --- | --- |
| 1 | #383 | format changed sources as a fixed implementer step | M | — |
| 2 | #386 | per-project override in `.agents/format.json` | S | #383 |
| 3 | #442 | worktrees on demand under `.worktrees/<nr>`, checkout lease, queue wiring | L | #402 (Tasks #443 #444 #465 #445) |

Feature #385 closes with #386.

### 2.5.0 — Epic #411, Feature #412: Rust stack package with Tauri

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

### 2.6.0 — Epic #387, Feature #388: dromos MVP

| Order | Issue | Title | Size | Depends on |
| --- | --- | --- | --- | --- |
| 1 | #389 | `SubagentStop` hook sends `progress` to `$DROMOS_URL/ingest` | M | #375; `POST /ingest` in `GravionLabs/dromos` |

Opt-in through `DROMOS_URL`; without it nothing changes.

### 2.6.0 — Epic #411, Feature #413: Go, JVM and Swift packages, frontend detection

| Order | Issue | Title | Size | Depends on |
| --- | --- | --- | --- | --- |
| 1 | #418 | `detect-techstack` reports react, vue, svelte and next as frameworks | S | #415 (serial edits of `detect-techstack`) |
| 2 | #419 | `go` package, detection via `go.mod` | M | #418 |
| 3 | #420 | `jvm` package for Java and Kotlin, detection via build files | M | #419; `needs-decision`: one `jvm` package or `java` + `kotlin` |
| 4 | #421 | `swift` package, detection via `Package.swift` | M | #420 |

Feature #413 closes with #421, Epic #411 with it. These PBIs share no files with #389 and may run in parallel to it.

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
| 1 | #391 | `pbi-runner` `GATE|BLOCKED|FAILED` as `attention` | S | #389; #579 adds `kind: GATE` with question and options, dromos#138 returns the attention id |
| 2 | #392 | queue runner reports `queue.item`, supports `-Mux` | M | #389 |
| 3 | #393 | status line reports `usage` | S | #389 |
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
- 2.6.0 and 2.7.0 depend on the dromos repository (ingest endpoint, dromos-mux); if it lags, those releases shift, nothing else does.
- 2.5.0 and 2.6.0 can swap without harm; 2.4.0 comes first because it is nearly done.
- #402 touches the same files as #386 and #389 (`Add-LedgerLine.ps1`, `subagent-ledger.sh`, the OpenCode plugin, the agents); if it slips, those two move behind it, not in front of it.
