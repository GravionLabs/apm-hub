# Roadmap

Order of work and release assignment for the open issues. Rewritten 2026-10-28 after dromos decision 004 (dromos archived at v0.4.0; delivery becomes a Claude Code workflow in apm-hub, the bus, Attention API and gates continue in [GravionLabs/keryx](https://github.com/GravionLabs/keryx)), updated the same day after `v3.2.0` and the spike #823. Updated 2026-10-29: `deliver` becomes a harness-neutral skill (Feature #860), keryx is archived (keryx#37) and a GitHub ruleset on `release/next` is the hard gate. Updated 2026-10-29 with the release PBI #839 and after its release: GitVersion tagged the planned 3.3.0 as `v3.2.1` (#881); the version stays, 3.3.0 is skipped and the next release is 3.4.0. Last release `v3.2.1` (2026-10-29). Each release has a GitHub milestone of the same name; work runs on `release/next` and the release PR into `main` is the human review point.

History: 2.x and the simplification plan that produced 3.0.0 and 3.1.0 are in [docs/simplification-plan.md](docs/simplification-plan.md) and [docs/simplification-workplan.md](docs/simplification-workplan.md). The dromos runner path (Stage B there) is closed by decision 004.

## Where we are

| Epic                                              | State                                                              | Note                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| #714 content-only repository (3.0.0)              | closed                                                             | released as `v3.0.0`                                                                   |
| #715 role skills and runner launcher (3.1.0)      | closed                                                             | released as `v3.1.0`; the launcher is replaced by `deliver` (#826) and removed by #828 |
| #821 deliver issues through Claude Code workflows | released as `v3.2.1`; open for Feature #661 (3.4.0)                | Feature #822 closed with `v3.2.1`; Feature #860 keeps the OpenCode trial #827          |
| #427 hub maintenance                              | open for [ci#89](https://github.com/GravionLabs/ci/issues/89) only | Feature #808 closed with 3.2.0                                                         |
| #411 stack packages                               | Feature #413 open (#420, #421)                                     | Go shipped in 3.2.0; JVM waits on a decision                                           |

## Done in 3.2.1 (planned as 3.3.0)

Released as `v3.2.1` instead of `v3.3.0` (#881); the number 3.3.0 is not used. The first release without any dromos surface (decision 004). `grill-me` (#824), `.agents/config.json` as the project config (#830), `planner` grills before it creates issues (#825), the `deliver` skill (#826), harness-neutral with plain subagents since #861, with claims for parallel sessions (#868), herdr pane titles (#855) and shell allowlists per harness (#862), the removal of the dromos launcher and runner setup (#828) and the agentlens trial (#829). The bugs of that trial: installer `provides` (#856) and `-Ref` for dependencies (#857), worktree cleanup after the merge (#858) and the PR title (#859). Not included: the OpenCode trial #827 moved to 3.4.0 (Feature #860). Migration: `.agents/config.json` replaces `.dromos/config.json` and `.agents/format.json` (README, "Upgrading to 3.2.1").

## Done in 3.2.0

Go package (#419) with its `go-test` rule for missing tools (#819), `pnpm run check` and PSScriptAnalyzer (#809, #810, Feature #808), the runner config example and install hint fixes (#811, #816), the first retro (#745), the spike report [docs/spikes/deliver.md](docs/spikes/deliver.md) (#823) and this roadmap. 3.2.0 still contains the `dromos init` setup of #804; #828 removes it in 3.2.1.

## 3.4.0 — learning path, follow-ups and stack packages

Milestone 3.4.0. `release/next` is cut again from `v3.2.1`. Order: #881 (version bump), the trials of Feature #860 (#863, then #827 and #864), the lessons PBIs of #661 (planned with `planner`), the format detection, #865, then #840.

| Issue | Title                                                                                                                                                                                                                              | Size | Depends on / decision                                                                    |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------- |
| #881  | Bug: a release from `release/next` is tagged as a patch on `main`; `finish` adds `+semver: minor`                                                                                                                                  | S    | —                                                                                        |
| #863  | trial of `deliver` in Claude Code (Feature #860)                                                                                                                                                                                   | S    | —                                                                                        |
| #661  | Feature: lessons contract. `.agents/lessons/*.md` read by `deliver`, `planner` and `code-review`; `retro` proposes and retires lessons; check validates the files. Under Epic #821                                                 | L    | #826; PBIs planned with `planner`                                                        |
| new   | `Format-Changed.ps1` repo detection without `-Language` (the dromos `detectFormatter` table: `scripts.format`, Biome, Prettier, ruff, `.sln`, `Cargo.toml`, `go.mod`), optional `PostToolUse` format hook for interactive sessions | M    | #830; decision whether apm-hub ships a hook again (AGENTS.md: no hooks package since P9) |
| #827  | trial of `deliver` in OpenCode, one PBI end to end (Feature #860); moved from 3.3.0                                                                                                                                                | S    | #863; `opencode auth login` with a provider                                              |
| #864  | trial of `deliver` in Copilot CLI (Feature #860)                                                                                                                                                                                   | S    | #863                                                                                     |
| #865  | retro over ten `deliver` runs; decides on `workflow.js`                                                                                                                                                                            | S    | #863, #827, #864                                                                         |
| #840  | release PBI for 3.4.0: CHANGELOG, release PR with `github-release`; the real scope is added as blockers after the planning round                                                                                                   | S    | #881, #661                                                                               |

#832 and #835 shipped early in `v3.2.1`. #420 and #421 (Feature #413, Epic #411) move out of 3.4.0 until #420 is decided. Feature #661 and Epic #821 close with the last lessons PBI. Improvement via `retro` is a requirement of the learning path: a lesson that `retro` proposes and a human approves must be in the next `deliver` run's context without a skill change.

## Feature #860 — deliver as a harness-neutral skill

Plan: [Einfache Auslieferung mit Skills und GitHub-Ruleset](https://claude.ai/artifact/BZCAKEQXeA4bDmBdYEwmQ9). One user-invoked skill for Claude Code, OpenCode and Copilot CLI, plain subagents with `implementation` and `code-review`, state from GitHub; `workflow.js` stays frozen until #865. Milestone is set when #861 is planned.

| Order | Issue | Title                                                                                                   | Size | Depends on       |
| ----- | ----- | ------------------------------------------------------------------------------------------------------- | ---- | ---------------- |
| 1     | #861  | `deliver` as a harness-neutral skill with plain subagents, under 100 lines, pause rules, `--unattended` | M    | —                |
| 2     | #862  | shell allowlists for `deliver` per harness                                                              | S    | #861             |
| 2     | #855  | `deliver` sets the herdr pane title per step                                                            | S    | #861             |
| 3     | #863  | trial in Claude Code (interactive and unattended)                                                       | S    | #861, #862       |
| 4     | #827  | trial in OpenCode                                                                                       | S    | #863             |
| 4     | #864  | trial in Copilot CLI                                                                                    | S    | #863             |
| 5     | #865  | retro over ten runs; decides on `workflow.js`                                                           | S    | #863, #827, #864 |

## Decided on 2026-10-29

| Topic                          | Decision                                                                                                                                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hard gate                      | GitHub ruleset 26098962 on `release/next`: `Build & Test`, `Test`, `No Generated Files in PR` required, no force push, no bypass (also not for admins); not on `main`, where `Regenerate & Commit` pushes directly and the release PR is merged by the owner |
| keryx                          | archived (keryx#37): the ruleset replaces the gate tools; `record_review` was self-reported; herdr detects agent state itself                                                                                                                                |
| Agents                         | no custom agent files; plain subagents load the skills. The multi-harness frontmatter of the `version-1-agents` branch is the template if OpenCode needs one for the model per role (#827)                                                                   |
| Copilot CLI                    | back as the third harness (1.0.105: skills, custom agents as subagents, MCP, hooks, deny rules)                                                                                                                                                              |
| Name                           | stays `deliver`: it ends at merge, `implement` would clash with `implementation` and with mattpocock's `implement`                                                                                                                                           |
| #846 `BLOCKED` attentions      | not planned; unattended runs comment on the issue and set `needs-decision`                                                                                                                                                                                   |
| #847 keryx release approval    | not planned, keryx is archived; the owner merges the release PR                                                                                                                                                                                              |
| Version of the release PR #880 | stays `v3.2.1`, no re-release; 3.3.0 is skipped, the next release is 3.4.0; #881 makes `finish` add `+semver: minor`                                                                                                                                         |
| #420, #421                     | out of 3.4.0 until #420 is decided                                                                                                                                                                                                                           |

## Decided on 2026-10-28

| Issue                                                                | Decision                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #520 `Set-Sprint.ps1` / `Set-ProjectStandard.ps1` miss project items | transferred to [ci#89](https://github.com/GravionLabs/ci/issues/89), the scripts live in `GravionLabs/ci` since A8                                                                                                                                                                                                                                                                                    |
| #661 lessons contract                                                | kept, re-parented from the closed Epic #573 to Epic #821, re-scoped to `deliver` and `retro`, milestone 3.4.0, blocked by #826                                                                                                                                                                                                                                                                        |
| #714 content-only repository                                         | closed                                                                                                                                                                                                                                                                                                                                                                                                |
| #823 spike                                                           | done; answers and decisions for #826 and #827 in [docs/spikes/deliver.md](docs/spikes/deliver.md)                                                                                                                                                                                                                                                                                                     |
| #824, #825 grilling                                                  | `grill-me` is rebuilt from the `grilling.md` removed in #732 (attribution to mattpocock/skills, MIT); `planner` creates the issues itself again after the user approves the grilled plan, since the dromos runner that did it is gone                                                                                                                                                                 |
| apmw                                                                 | stays frozen: neither the workflow script nor the OpenCode deny rule needs it                                                                                                                                                                                                                                                                                                                         |
| keryx refinement                                                     | keryx runs the gate itself (`run_gate` reads `.agents/config.json` key `gate`, #826 adds it to the schema); `keryx mcp` is a stdio server; `open_pr`/`merge` split into keryx#20; PR and CI state reach herdr only as events from `deliver` or the gate tools; keryx 0.1.0 = bus, session events, gates (keryx#21), 0.2.0 = herdr plugin (keryx#22); the Attention API (keryx#9) waits for a producer |

## Dependencies on other repositories

| Repository     | Needed for                                                                                                        | Status |
| -------------- | ----------------------------------------------------------------------------------------------------------------- | ------ |
| agentlens #436 | the cost of `deliver` subagents (`subagents/workflows/<runId>/`) shows up in agentlens; #832 role share           | open   |
| agentlens      | #829 trial repository                                                                                             | —      |
| ci             | [ci#89](https://github.com/GravionLabs/ci/issues/89) (project items walk); `issues.yml` sets the `[Level]` prefix | —      |

## Risks

- The deliver chain is serial (#824 → #825 → #826 → #828/#829), and #826 is the only L. Split it while planning if its task breakdown does not fit one session.
- Cost: workflow subagents inherit the session model and start with about 30 k cached context tokens each (spike, section 4). A `deliver` run over a Feature without `model` and `effort` per role is expensive; #829 reports the cost per PBI, and it stays invisible in agentlens until agentlens#436 is merged.
- Unattended runs stop on permission prompts: every command a role skill runs must be on the target repository's allowlist and avoid quoted substitutions (spike, section 2).
- 3.2.0 ships the dromos setup of #804 and 3.2.1 removes it. Users who run `apm-install` in between get a `.dromos/config.json`; #828 and `after-install.md` must say how to migrate it to `.agents/config.json`.
- `.agents/` is both an install target (`.agents/skills/`) and the home of the committed config; a project that ignores the whole directory loses the config. #830 adds the installer notice; until then the gitignore exception is documented only in `docs/usage/project-config.md`.
- `retro` still reads `dromos run metrics` (SKILL.md step 1), and dromos is archived. Retro keeps working on review findings and transcripts, but its cost and duration columns are `n/a` until #832 (3.4.0). Every retro-based lesson proposal (#661) depends on that fallback until then.
- #827 needs an OpenCode provider login for its trial.
- A repository without the `release/next` ruleset can merge red again; #861 warns at start, and every repository that runs `deliver` gets the ruleset with its own check names.
