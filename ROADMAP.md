# Roadmap

Order of work and release assignment for the open issues. Rewritten 2026-10-28 after dromos decision 004 (dromos archived at v0.4.0; delivery becomes a Claude Code workflow in apm-hub, the bus, Attention API and gates continue in [GravionLabs/keryx](https://github.com/GravionLabs/keryx)), updated the same day after `v3.2.0` and the spike #823. Updated 2026-10-29: `deliver` becomes a harness-neutral skill (Feature #860), keryx is archived (keryx#37) and a GitHub ruleset on `release/next` is the hard gate. Last release `v3.2.0` (2026-10-28). Each release has a GitHub milestone of the same name; work runs on `release/next` and the release PR into `main` is the human review point.

History: 2.x and the simplification plan that produced 3.0.0 and 3.1.0 are in [docs/simplification-plan.md](docs/simplification-plan.md) and [docs/simplification-workplan.md](docs/simplification-workplan.md). The dromos runner path (Stage B there) is closed by decision 004.

## Where we are

| Epic | State | Note |
| --- | --- | --- |
| #714 content-only repository (3.0.0) | closed | released as `v3.0.0` |
| #715 role skills and runner launcher (3.1.0) | closed | released as `v3.1.0`; the launcher is replaced by `deliver` (#826) and removed by #828 |
| #821 deliver issues through Claude Code workflows | the chain up to #829 merged, next the bugs #856–#859 and the release PBI #839 | Feature #822 holds every PBI of 3.3.0; Feature #860 makes `deliver` harness-neutral; Feature #661 is 3.4.0 |
| #427 hub maintenance | open for [ci#89](https://github.com/GravionLabs/ci/issues/89) only | Feature #808 closed with 3.2.0 |
| #411 stack packages | Feature #413 open (#420, #421) | Go shipped in 3.2.0; JVM waits on a decision |

## Done in 3.2.0

Go package (#419) with its `go-test` rule for missing tools (#819), `pnpm run check` and PSScriptAnalyzer (#809, #810, Feature #808), the runner config example and install hint fixes (#811, #816), the first retro (#745), the spike report [docs/spikes/deliver.md](docs/spikes/deliver.md) (#823) and this roadmap. 3.2.0 still contains the `dromos init` setup of #804; #828 removes it in 3.3.0.

## 3.3.0 — Epic #821: deliver through Claude Code workflows

Feature #822. The chain #824 → #825 → #826 is serial; #830 and #827 are the parallel strands.

| Order | Issue | Title | Size | Depends on |
| --- | --- | --- | --- | --- |
| merged | #824 | `grill-me` skill, rebuilt from the `grilling.md` removed in #732: rounds of questions with the recommendation first, AskUserQuestion when available, answers under `## Decisions` or returned as `questions[]` | S | — (#823 done) |
| merged | #830 | `.agents/config.json` as the project config, `format` override moves in from `.agents/format.json` | S | — |
| merged | #825 | `planner` grills before it creates the issues (plan → `grill-me` → approval → `create-from-plan.md`), task breakdown per PBI, `refine <nr>` | M | #824 |
| merged | #826 | `deliver` skill and workflow: Epic/Feature/PBI, worktree, gate, `code-review`, ≤ 2 fix rounds, PR, CI wait, merge; adds `base`, models per role and `gate` (the verify commands, also read by keryx `run_gate`) to `.agents/config.json`; posts `pr.opened`, `ci.finished`, `pr.merged` through `keryx event` when keryx runs | L | #825, #830 |
| merged | #828 | remove the dromos launcher and runner setup (`/orchestrator`, `dromos init` in `apm-install`, `.dromos/`) | S | #826 |
| merged | #829 | trial: `/deliver` on one small agentlens PBI; findings become issues | S | #826 |
| 1 | #856 | bug: `provides` of the installer lists an old skill set; `provides` follows `x-skills` of each `apm.yml`, checked by a test | S | — (found in #829) |
| 1 | #857 | bug: installer `-Ref` does not reach the dependencies `shared` and `github` of `delivery` | S | — (found in #829) |
| 2 | #858 | bug: `deliver` leaves `wf_*` worktrees and a `wip-*` branch after the run | S | — (found in #829) |
| 2 | #859 | bug: `deliver` shortens the PR title against the issue title | S | — (found in #829) |
| last | #839 | release PBI: CHANGELOG, migration note, `git grep dromos` clean, release PR with `github-release` | S | #830, #824, #825, #826, #828, #829, #856, #857, #858, #859 |

Rules for this release:

- #830 is merged before #826 starts; #826 must not reintroduce a tool-named config path.
- #830 and #828 land in the same release: `.agents/config.json` replaces `.dromos/config.json` and `.agents/format.json` in one migration note.
- #828 lands before the release is cut, so 3.3.0 is the first release without any dromos surface; `after-install.md` names keryx where it named dromos.
- #826 follows the spike decisions: `workflow.js` next to `SKILL.md`, `scriptPath` for project installs and the script passed inline for global installs; a stable `label` per role (`implement #<nr>`, `gate #<nr>`, `review #<nr>`, `fix #<nr>`, `pr #<nr>`); `model` and `effort` on every `agent()` call; the skill checks that the verify, format and `gh` commands of the target repository are on its allowlist before it starts.
- #827 moved to Feature #860 (trial of `deliver` in OpenCode); it no longer depends on keryx.
- One PBI at a time on `release/next`: #826, #828 and #829 all edit the `delivery` package.
- The bugs from the #829 trial ship in 3.3.0. #856 and #857 fix the installer and come first, since a `-Ref` install otherwise runs `delivery` against older `shared` skills. #858 and #859 were found in a `workflow.js` run; since #861 `deliver` is a skill with plain subagents and `workflow.js` is frozen until #865, so each fix goes into the skill, and a bug that only `workflow.js` has moves to Feature #860.

Epic #821 keeps Feature #661 open; Feature #822 closes with #829 (acceptance: `/deliver <nr>` runs without questions after grilling; planning is interactive with `grill-me`; no dromos launcher or setup left).

## 3.4.0 — learning path, follow-ups and stack packages

Milestone 3.4.0. Planned in detail with `planner` once 3.3.0 is cut.

| Issue | Title | Size | Depends on / decision |
| --- | --- | --- | --- |
| #835 | `code-review` reads the `## Review rules` of the `<lang>-test` skills; drops the pointer line of #834 in `go-implementation` | S | — (can move into 3.3.0 between two PBIs of the chain) |
| #832 | `retro` reads agentlens (cost, requests, role share) and GitHub (fix and review rounds, CI) instead of `dromos run metrics`; escalation lines from the `deliver` report. Under Feature #661 | M | #826; role share needs [agentlens#436](https://github.com/GravionLabs/agentlens/issues/436) |
| #661 | Feature: lessons contract. `.agents/lessons/*.md` read by `deliver`, `planner` and `code-review`; `retro` proposes and retires lessons; check validates the files. Under Epic #821 | L | #826; PBIs planned with `planner` |
| new | `Format-Changed.ps1` repo detection without `-Language` (the dromos `detectFormatter` table: `scripts.format`, Biome, Prettier, ruff, `.sln`, `Cargo.toml`, `go.mod`), optional `PostToolUse` format hook for interactive sessions | M | #830; decision whether apm-hub ships a hook again (AGENTS.md: no hooks package since P9) |
| #420 | `jvm` package for Java and Kotlin | M | `needs-decision`: one `jvm` package or `java` + `kotlin` |
| #421 | `swift` package, detection via `Package.swift` | M | #420 |
| #827 | OpenCode orchestrator (if keryx is late) | M | keryx 0.1.0 (keryx#21) |
| #840 | release PBI for 3.4.0: CHANGELOG, release PR with `github-release`; the real scope is added as blockers after the planning round | S | #839, #832 |

Feature #413 and Epic #411 close with #421; Feature #661 and Epic #821 close with the last lessons PBI. Improvement via `retro` is a requirement of the learning path: a lesson that `retro` proposes and a human approves must be in the next `deliver` run's context without a skill change.

## Feature #860 — deliver as a harness-neutral skill

Plan: [Einfache Auslieferung mit Skills und GitHub-Ruleset](https://claude.ai/artifact/BZCAKEQXeA4bDmBdYEwmQ9). One user-invoked skill for Claude Code, OpenCode and Copilot CLI, plain subagents with `implementation` and `code-review`, state from GitHub; `workflow.js` stays frozen until #865. Milestone is set when #861 is planned.

| Order | Issue | Title | Size | Depends on |
| --- | --- | --- | --- | --- |
| 1 | #861 | `deliver` as a harness-neutral skill with plain subagents, under 100 lines, pause rules, `--unattended` | M | — |
| 2 | #862 | shell allowlists for `deliver` per harness | S | #861 |
| 2 | #855 | `deliver` sets the herdr pane title per step | S | #861 |
| 3 | #863 | trial in Claude Code (interactive and unattended) | S | #861, #862 |
| 4 | #827 | trial in OpenCode | S | #863 |
| 4 | #864 | trial in Copilot CLI | S | #863 |
| 5 | #865 | retro over ten runs; decides on `workflow.js` | S | #863, #827, #864 |

## Decided on 2026-10-29

| Topic | Decision |
| --- | --- |
| Hard gate | GitHub ruleset 26098962 on `release/next`: `Build & Test`, `Test`, `No Generated Files in PR` required, no force push, no bypass (also not for admins); not on `main`, where `Regenerate & Commit` pushes directly and the release PR is merged by the owner |
| keryx | archived (keryx#37): the ruleset replaces the gate tools; `record_review` was self-reported; herdr detects agent state itself |
| Agents | no custom agent files; plain subagents load the skills. The multi-harness frontmatter of the `version-1-agents` branch is the template if OpenCode needs one for the model per role (#827) |
| Copilot CLI | back as the third harness (1.0.105: skills, custom agents as subagents, MCP, hooks, deny rules) |
| Name | stays `deliver`: it ends at merge, `implement` would clash with `implementation` and with mattpocock's `implement` |
| #846 `BLOCKED` attentions | not planned; unattended runs comment on the issue and set `needs-decision` |

## Decided on 2026-10-28

| Issue | Decision |
| --- | --- |
| #520 `Set-Sprint.ps1` / `Set-ProjectStandard.ps1` miss project items | transferred to [ci#89](https://github.com/GravionLabs/ci/issues/89), the scripts live in `GravionLabs/ci` since A8 |
| #661 lessons contract | kept, re-parented from the closed Epic #573 to Epic #821, re-scoped to `deliver` and `retro`, milestone 3.4.0, blocked by #826 |
| #714 content-only repository | closed |
| #823 spike | done; answers and decisions for #826 and #827 in [docs/spikes/deliver.md](docs/spikes/deliver.md) |
| #824, #825 grilling | `grill-me` is rebuilt from the `grilling.md` removed in #732 (attribution to mattpocock/skills, MIT); `planner` creates the issues itself again after the user approves the grilled plan, since the dromos runner that did it is gone |
| apmw | stays frozen: neither the workflow script nor the OpenCode deny rule needs it |
| keryx refinement | keryx runs the gate itself (`run_gate` reads `.agents/config.json` key `gate`, #826 adds it to the schema); `keryx mcp` is a stdio server; `open_pr`/`merge` split into keryx#20; PR and CI state reach herdr only as events from `deliver` or the gate tools; keryx 0.1.0 = bus, session events, gates (keryx#21), 0.2.0 = herdr plugin (keryx#22); the Attention API (keryx#9) waits for a producer |

## Dependencies on other repositories

| Repository | Needed for | Status |
| --- | --- | --- |
| agentlens #436 | the cost of `deliver` subagents (`subagents/workflows/<runId>/`) shows up in agentlens; #832 role share | open |
| agentlens | #829 trial repository | — |
| ci | [ci#89](https://github.com/GravionLabs/ci/issues/89) (project items walk); `issues.yml` sets the `[Level]` prefix | — |

## Risks

- The deliver chain is serial (#824 → #825 → #826 → #828/#829), and #826 is the only L. Split it while planning if its task breakdown does not fit one session.
- Cost: workflow subagents inherit the session model and start with about 30 k cached context tokens each (spike, section 4). A `deliver` run over a Feature without `model` and `effort` per role is expensive; #829 reports the cost per PBI, and it stays invisible in agentlens until agentlens#436 is merged.
- Unattended runs stop on permission prompts: every command a role skill runs must be on the target repository's allowlist and avoid quoted substitutions (spike, section 2).
- 3.2.0 ships the dromos setup of #804 and 3.3.0 removes it. Users who run `apm-install` in between get a `.dromos/config.json`; #828 and `after-install.md` must say how to migrate it to `.agents/config.json`.
- `.agents/` is both an install target (`.agents/skills/`) and the home of the committed config; a project that ignores the whole directory loses the config. #830 adds the installer notice; until then the gitignore exception is documented only in `docs/usage/project-config.md`.
- `retro` still reads `dromos run metrics` (SKILL.md step 1), and dromos is archived. Retro keeps working on review findings and transcripts, but its cost and duration columns are `n/a` until #832 (3.4.0). Every retro-based lesson proposal (#661) depends on that fallback until then.
- #827 needs an OpenCode provider login for its trial.
- A repository without the `release/next` ruleset can merge red again; #861 warns at start, and every repository that runs `deliver` gets the ruleset with its own check names.
