# Roadmap

Order of work and release assignment for the open issues. Created 2026-10-18, last release `v2.3.0` (2026-10-16). Each release has a GitHub milestone of the same name. Work runs one PBI at a time on `release/next` (several PBIs edit `orchestrator.agent.md` or the ledger hook).

## 2.4.0 — Feature runs and hardening (`release/next`, already contains #250 #253 #307 #309 #338 #339 #350 #354 #357 #358 #363)

| Order | Issue | Title | Size | Note |
| --- | --- | --- | --- | --- |
| 1 | #375 | loop-mode ledger lines before the PBI branch exists | S | merged; before #402 and #389: same hook file |
| 2 | #402 | worktree-shared state directory (git common dir, `DROMOS_STATE_DIR`) | L | Tasks #403–#410; after #375 (same hook files), before #386 and #389, which build on the path; #379 is already merged, so `Write-StatusTable.ps1` is adapted in #403; `.agents/` → `.dromos/` stays at 3.0.0 (dromos#70); client follow-ups in Feature #432 (#422–#426) are not part of this release |
| 3 | #367 | git-guardrails scanner quadratic on bash 3.2 | S | independent |
| 4 | #252 | `github-release` refuses an already released branch | S | protects this very release; do before cutting |
| 5 | #251 | model policy, opus in `plan.json`, escalation at fix round 2 | M | `needs-decision`: decide first, otherwise it moves to 2.5.0 |

Closing: Feature #248 and Epic #300 once #402 and #251 are merged. Then `github-release` finish.

## 2.5.0 — Epic #384: format changed sources

| Order | Issue | Title | Size | Depends on |
| --- | --- | --- | --- | --- |
| 1 | #383 | format changed sources as a fixed implementer step | M | — |
| 2 | #386 | per-project override in `.agents/format.json` | S | #383 |

Feature #385 closes with #386.

### 2.5.0 — Epic #411, Feature #412: Rust stack package with Tauri

| Order | Issue | Title | Size | Depends on |
| --- | --- | --- | --- | --- |
| 1 | #414 | ROADMAP.md schedules Epic #411 | S | — |
| 2 | #415 | `detect-techstack` detects Rust and Tauri | S | — |
| 3 | #416 | `rust` package with `rust-implementation` and `rust-test` | M | #415 |
| 4 | #417 | Tauri conventions in `rust-implementation` | S | #416 |

Feature #412 closes with #417. The stack PBIs share no files with the orchestrator PBIs of this release (`detect-techstack`, new `packages/<lang>/`, README and AGENTS.md tables) and may run in parallel to #383 and #386.

## 2.6.0 — Epic #387, Feature #388: dromos MVP

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

## 2.7.0 — Feature #390: attention, queue, usage, `/dromos-mux`

| Order | Issue | Title | Size | Depends on |
| --- | --- | --- | --- | --- |
| 1 | #391 | `pbi-runner` `GATE|BLOCKED|FAILED` as `attention` | S | #389 |
| 2 | #392 | queue runner reports `queue.item`, supports `-Mux` | M | #389 |
| 3 | #393 | status line reports `usage` | S | #389 |
| 4 | #394 | user-invoked `/dromos-mux` skill in `delivery` | M | #392, dromos-mux released |

Epic #387 closes with #394.

### After 2.7.0 — Feature #398: queue runner as driver on the bus session API

Not scheduled yet. Splits `Invoke-OrchestratorQueue.ps1` into driver (stays in apm-hub) and executor (bus session API, `GravionLabs/dromos` Feature #61); #392's `-Mux` is reworked into it. Order in dromos: `ROADMAP.md` there, stage 4.

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

## Risks

- #398 depends on the session API in dromos#61; until then the local executor stays the only one.
- 2.6.0 and 2.7.0 depend on the dromos repository (ingest endpoint, dromos-mux); if it lags, those releases shift, nothing else does.
- 2.5.0 and 2.6.0 can swap without harm; 2.4.0 comes first because it is nearly done.
- #402 touches the same files as #386 and #389 (`Add-LedgerLine.ps1`, `subagent-ledger.sh`, the OpenCode plugin, the agents); if it slips, those two move behind it, not in front of it.
