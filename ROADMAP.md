# Roadmap

Order of work and release assignment for the open issues. Rewritten 2026-10-28 after dromos decision 004 (dromos archived at v0.4.0; delivery becomes a Claude Code workflow in apm-hub, the bus, Attention API and gates continue in [GravionLabs/keryx](https://github.com/GravionLabs/keryx)). Last release `v3.1.0` (2026-10-28). Each release has a GitHub milestone of the same name; work runs on `release/next` and the release PR into `main` is the human review point.

History: 2.x and the simplification plan that produced 3.0.0 and 3.1.0 are in [docs/simplification-plan.md](docs/simplification-plan.md) and [docs/simplification-workplan.md](docs/simplification-workplan.md). The dromos runner path (Stage B there) is closed by decision 004.

## Where we are

| Epic | State | Note |
| --- | --- | --- |
| #714 content-only repository (3.0.0) | closed 2026-10-28 | released as `v3.0.0` |
| #715 role skills and runner launcher (3.1.0) | Feature #806 open | released as `v3.1.0`; #806 closes when #811 (merged) is closed with 3.2.0 |
| #821 deliver issues through Claude Code workflows | planned, no PBI started | replaces the runner launcher of #715; Feature #822 holds every PBI |
| #427 hub maintenance | Feature #808 open (PBIs merged) | closes with 3.2.0; Bug #520 moved to [ci#89](https://github.com/GravionLabs/ci/issues/89) |
| #411 stack packages | Feature #413 open (#419 merged, #420, #421) | Go ships in 3.2.0; JVM waits on a decision |

`release/next` carries seven commits since `v3.1.0` (#419, #809, #810, #804, #811, #816, #745). #804 installs the dromos runner setup that #828 removes again; releasing it once is cheaper than holding 3.2.0 until #828, which sits behind the whole deliver chain.

## 3.2.0 — ship what is merged

Cut once #819 is merged (size S, no blockers). The Go package of #419 is new in this release, so its test rule ships with it. #830 (`.agents/config.json`) goes into 3.3.0: 3.2.0 still contains the `dromos init` setup of #804 that writes `.dromos/config.json`, and two project config files in one release would need two migration notes.

| Order | Issue | Title | Size | Depends on |
| --- | --- | --- | --- | --- |
| merged | #419 | `go` package with `go-implementation` and `go-test`, detection via `go.mod` | M | — |
| merged | #809, #810 | `pnpm run check` bundles the CI checks; PSScriptAnalyzer over the skill scripts (Feature #808) | S | — |
| merged | #811 | runner config example in `after-install.md` (Feature #806) | S | — |
| 1 | #819 | `go-test` rule: a test for a missing tool empties `PATH` | S | — |

Closes with the release: Features #806 and #808, Epic #715.

## 3.3.0 — Epic #821: deliver through Claude Code workflows

Feature #822. The chain is serial through the spike and the planning skills; #830 and #827 are the parallel strands.

| Order | Issue | Title | Size | Depends on |
| --- | --- | --- | --- | --- |
| 0 | #830 | `.agents/config.json` as the project config, `format` override moves in from `.agents/format.json`; first in the release, no blockers | S | — |
| 1 | #823 | spike: workflow subagents and skills, `scriptPath` in an installed skill, headless `claude -p "/deliver"`, agentlens metadata, OpenCode skills and plugin events; report in `docs/spikes/deliver.md` | S | — (in progress, branch `chore/823-spike-deliver`) |
| 2 | #824 | `grill-me` skill: one question at a time, decisions written to the issue, non-interactive mode returns questions as data | S | #823 |
| 3 | #825 | `issue-planning` grills first and supports `refine <nr>` | M | #824 |
| 4 | #826 | `deliver` skill and workflow: Epic/Feature/PBI, worktree, gate, `code-review`, ≤ 2 fix rounds, PR, CI wait, merge; adds the keys it needs (`base`, models per role) to `.agents/config.json` and its schema | L | #823, #825, #830 (merged on `release/next`) |
| 5 | #828 | remove the dromos launcher and runner setup (`/orchestrator`, `dromos init` in `apm-install`, `.dromos/`) | S | #826 |
| 6 | #829 | trial: `/deliver` on one small agentlens PBI; findings become issues | S | #826 |
| parallel | #827 | OpenCode orchestrator and role agents; PR and merge only through the keryx gate tools | M | #823, keryx#12 (`open_pr`/`merge` MCP tools), keryx#13 (plugin denies `gh pr create`/`merge`) |
| last | #839 | release PBI: CHANGELOG, migration note, `git grep dromos` clean, release PR with `github-release` | S | #830, #824, #825, #826, #828, #829 (and #827 if it stays in) |

Rules for this release:

- #826 reads `.agents/config.json` from #830, so #830 is merged before #826 starts; `#826` must not reintroduce a tool-named config path.
- #830 and #828 land in the same release: `.agents/config.json` replaces `.dromos/config.json` and `.agents/format.json` in one migration note.
- #828 lands before the release is cut, so 3.3.0 is the first release without any dromos surface; `after-install.md` names keryx where it named dromos.
- #827 can ship in 3.3.0 only if keryx#12 and keryx#13 are released; otherwise it moves to 3.4.0 and 3.3.0 ships Claude Code only. keryx is at the planning stage (README only, Epic keryx#1 with Features #2, #5, #8, #11, #14).
- One PBI at a time on `release/next`: #824–#826 all edit the `delivery` package and `issue-planning`.

Epic #821 closes with #829 (acceptance: `/deliver <nr>` runs without questions after grilling; planning is interactive with `grill-me`; no dromos launcher or setup left).

## 3.4.0 — learning path, follow-ups and stack packages

Milestone 3.4.0. Planned in detail with `issue-planning` once 3.3.0 is cut.

| Issue | Title | Size | Depends on / decision |
| --- | --- | --- | --- |
| #661 | Feature: lessons contract. `.agents/lessons/*.md` read by `deliver`, `issue-planning` and `code-review`; `retro` proposes and retires lessons; check validates the files. Under Epic #821 | L | #826; PBIs planned with `issue-planning` |
| #832 | `retro` reads agentlens (cost, requests, role share) and GitHub (fix and review rounds, CI) instead of `dromos run metrics`; escalation lines from the `deliver` report. Under Feature #661 | M | #826; blocks the metrics columns of `retro`, not the lesson proposals |
| new | `Format-Changed.ps1` repo detection without `-Language` (the dromos `detectFormatter` table: `scripts.format`, Biome, Prettier, ruff, `.sln`, `Cargo.toml`, `go.mod`), optional `PostToolUse` format hook for interactive sessions | M | #830; decision whether apm-hub ships a hook again (AGENTS.md: no hooks package since P9) |
| #420 | `jvm` package for Java and Kotlin | M | `needs-decision`: one `jvm` package or `java` + `kotlin`; blocked by #419 (merged) |
| #421 | `swift` package, detection via `Package.swift` | M | #420 |
| #827 | OpenCode orchestrator (if keryx is late) | M | keryx#12, keryx#13 |
| #840 | release PBI for 3.4.0: CHANGELOG, release PR with `github-release`; the real scope is added as blockers after the planning round | S | #839, #832 |

Feature #413 and Epic #411 close with #421; Feature #661 closes with its last PBI. Improvement via `retro` is a requirement of the learning path: a lesson that `retro` proposes and a human approves must be in the next `deliver` run's context without a skill change.

## Decided on 2026-10-28

| Issue | Decision |
| --- | --- |
| #520 `Set-Sprint.ps1` / `Set-ProjectStandard.ps1` miss project items | transferred to [ci#89](https://github.com/GravionLabs/ci/issues/89), the scripts live in `GravionLabs/ci` since A8 |
| #661 lessons contract | kept, re-parented from the closed Epic #573 to Epic #821, re-scoped to `deliver` and `retro`, milestone 3.4.0, blocked by #826 |
| #714 content-only repository | closed |

## Dependencies on other repositories

| Repository | Needed for | Status |
| --- | --- | --- |
| keryx #12, #13 | #827 (gate tools, plugin deny) | planned |
| keryx #6, #7 | session events for herdr; not a blocker for apm-hub | planned |
| agentlens | #829 trial repository; #823 question 5 (subagent metadata as role) | — |
| ci | [ci#89](https://github.com/GravionLabs/ci/issues/89) (project items walk); `issues.yml` sets the `[Level]` prefix | — |

## Risks

- The deliver chain is serial (#823 → #824 → #825 → #826 → #828/#829): a "no" in the spike (workflow `scriptPath` inside an installed skill, headless `/deliver`) changes #826's design before any code exists. The spike names a fallback for every "no", so the chain slips, it does not break.
- 3.2.0 ships the dromos setup of #804 and 3.3.0 removes it. Users who run `apm-install` in between get a `.dromos/config.json`; #828 and `after-install.md` must say how to migrate it to `.agents/config.json`.
- `.agents/` is both an install target (`.agents/skills/`) and the home of the committed config; a project that ignores the whole directory loses the config. #830 adds the installer notice; until then the gitignore exception is documented only in `docs/usage/format-override.md`.
- `retro` still reads `dromos run metrics` (SKILL.md step 1), and dromos is archived. Retro keeps working on review findings and transcripts, but its cost and duration columns are `n/a` until the input is replaced (3.4.0). Every retro-based lesson proposal (#661) depends on that fallback until #832 is merged.
- #827 depends on keryx, which has no code yet. Shipping 3.3.0 Claude Code only is the planned fallback.
