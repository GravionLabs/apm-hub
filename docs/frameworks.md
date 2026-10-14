# External skill and agent frameworks

What exists, what it ships, and whether it fits a lean solo setup that runs Claude Code, GitHub
Copilot and OpenCode from one source. Reviewed 2026-10-12; star counts and plugin numbers are
approximate.

| Framework | Ships | Clients | Fit | We use |
| :-- | :-- | :-- | :-- | :-- |
| [angular/skills](https://github.com/angular/skills) (official) | `angular-developer`: one router SKILL.md plus ~30 references; `angular-new-app` | all skills clients | **Adopt.** Progressive disclosure done right; overlaps `ng-implementation`. Generic, no project conventions. APM path: `angular/skills/angular-developer#<sha>`. | planned (#94) |
| [dotnet/skills](https://github.com/dotnet/skills) (Microsoft) | 17 plugins under `plugins/`; `dotnet` = 4 skills + C# LSP, `dotnet-test` = 23 skills + 10 agents | Copilot CLI, Claude Code, VS Code, Cursor, Codex | **Adopt `plugins/dotnet` only.** `dotnet-test` floods the skill list. Pin with `#<sha>`. | decision open (#94) |
| [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) | ~300 plugins: `commit-commands`, `pr-review-toolkit`, `code-review`, `feature-dev`, `skill-creator`, `security-guidance`, LSP plugins | Claude Code only | **Selective:** `skill-creator`, `pr-review-toolkit` (compare with `review-fanout` on one PR). `/plugin` shows the context cost of each. Nothing for Copilot or OpenCode. | user-local |
| [anthropics/skills](https://github.com/anthropics/skills) | docx/pdf/pptx/xlsx, frontend-design, mcp-builder, skill-creator; the spec | Claude Code, claude.ai, API | Reference for skill authoring; no overlap with the workflow skills. | via `/plugin` |
| [obra/superpowers](https://github.com/obra/superpowers) | 15 skills: TDD, brainstorming, writing-plans, subagent-driven-development, systematic-debugging; SessionStart bootstrap; v7.0.0 (2026-10-09) | Claude, Codex, Cursor, OpenCode, Copilot CLI, Gemini, … | **Borrow, not adopt** (#96 closed without the A/B run, see [Evaluations](#evaluations)). Four mechanics copied into the agents (#113); no issue or release-branch model, no stack skills, mandatory bootstrap per session. | borrowed |
| [github/awesome-copilot](https://github.com/github/awesome-copilot) | ~100 agents, skills, instructions, plugins (Gem Planner/Implementer/Reviewer, .NET agents) | Copilot CLI/VS Code; APM-installable | Cherry-pick single agents by path if ever needed; agents are verbose. | no |
| [wshobson/agents](https://github.com/wshobson/agents) | 94 plugins, 202 agents, 184 skills; one Claude source + adapters for Codex/Cursor/OpenCode/Copilot | Claude Code primary | Reference design for multi-client agent translation (what `apmw` does); far too large to adopt. | no |
| [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents), [davila7/claude-code-templates](https://github.com/davila7/claude-code-templates) | 100+ agents each | Claude Code | **No.** Every installed agent description sits in context each turn; generic prompts. | no |
| [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) | persona-based skills method (PM, architect, dev, test) | Claude Code, Codex, any skills client | **No.** Heavy ceremony, large context. | no |
| [vercel-labs/skills](https://github.com/vercel-labs/skills) (`npx skills add`) | skills-only distributor, ~80 clients | all | APM is the superset (agents, hooks, MCP, lockfile); no switch. | no |
| [agentskills.io](https://agentskills.io/specification) | the SKILL.md spec | all | Followed; client keys (`context`, `disable-model-invocation`) are allowed extensions. | yes |
| [microsoft/apm](https://github.com/microsoft/apm) | package manager: skills, agents, prompts, instructions, hooks, MCP; `apm.yml` dependencies with virtual paths and pins | Copilot, Claude, OpenCode, Cursor, Codex, Kiro, … | The distribution layer of this hub. Agents are copied verbatim per target, hence [apmw](https://github.com/GravionLabs/apmw). | yes |

## Evaluations

### obra/superpowers v7.0.0 (desk analysis, 2026-10-12)

**Why not adopt.**

- No GitHub issue, sub-issue or release-branch model. Its unit of work is a spec file plus a plan
  file under `docs/superpowers/`; this hub's unit is the Epic → Feature → PBI → Task issue and a PR
  per PBI into `release/next`. Adopting it means rebuilding `orchestrator` on top of it.
- No stack skills. TDD is generic; `<lang>-implementation` and `<lang>-test` stay necessary.
- A SessionStart hook injects `using-superpowers` into every session and demands a skill check
  before any action, including clarifying questions. That collides with `orchestrator` step 0 and
  with gated skills, and two mandatory process layers produce two review seats and two planning
  artifacts per change.
- Cost: its own strict-cost spec reports ~13 USD and ~150 controller turns per plan run on Opus and
  proposes a mid-tier orchestrator subagent as the remedy. `docs/working-mode.md` targets an
  orchestrator context under 60k tokens.
- A second distribution channel (a plugin per harness) next to apm and `apmw`.

**What we borrowed** (Feature #113, MIT licensed, source files under `skills/subagent-driven-development/`):

| Mechanic | Where it landed | Superpowers source |
| :-- | :-- | :-- |
| Report file plus a status contract (`DONE`, `DONE_WITH_CONCERNS`, `BLOCKED`, `NEEDS_CONTEXT`) | `implementer`, #114 | `implementer-prompt.md` |
| Review package as a file, `BASE` recorded before the dispatch | `review-fanout`, `reviewer`, #115 | `scripts/review-package`, `SKILL.md` |
| Per-issue ledger with `Ruling:` lines, resume after compaction | `orchestrator`, #116, hook #121 | `scripts/sdd-workspace`, `SKILL.md` |
| Explicit model per dispatch, fix loop that escalates one tier | `orchestrator`, #117 | `SKILL.md` "Model Selection" |

`brainstorming` and `systematic-debugging` have no counterpart here. They could be imported as
standalone skills without the hook; that is an open owner decision, not yet an issue.

## How to add an external pack

1. Find the smallest installable unit: a SKILL.md directory or a plugin directory, not a repo root
   (`angular/skills` root is not a package; `dotnet/skills` root installs everything).
2. Probe in a scratch directory: `apm install` with `targets: [claude]` and count the deployed
   `SKILL.md` and agent files. More than ~5 descriptions per pack needs a reason.
3. Pin the ref (`#<tag or sha>`), add the dependency to the package `apm.yml`, regenerate the lock.
4. Remove what the pack now covers from the own skill; keep project conventions and `## Review rules`.
