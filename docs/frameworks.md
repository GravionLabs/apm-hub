# External skill and agent frameworks

What exists, what it ships, and whether it fits a lean solo setup that runs Claude Code, GitHub
Copilot and OpenCode from one source. Reviewed 2026-10-11; star counts and plugin numbers are
approximate.

| Framework | Ships | Clients | Fit | We use |
| :-- | :-- | :-- | :-- | :-- |
| [angular/skills](https://github.com/angular/skills) (official) | `angular-developer`: one router SKILL.md plus ~30 references; `angular-new-app` | all skills clients | **Adopt.** Progressive disclosure done right; overlaps `ng-implementation`. Generic, no project conventions. APM path: `angular/skills/angular-developer#<sha>`. | planned (#94) |
| [dotnet/skills](https://github.com/dotnet/skills) (Microsoft) | 17 plugins under `plugins/`; `dotnet` = 4 skills + C# LSP, `dotnet-test` = 23 skills + 10 agents | Copilot CLI, Claude Code, VS Code, Cursor, Codex | **Adopt `plugins/dotnet` only.** `dotnet-test` floods the skill list. Pin with `#<sha>`. | decision open (#94) |
| [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) | ~300 plugins: `commit-commands`, `pr-review-toolkit`, `code-review`, `feature-dev`, `skill-creator`, `security-guidance`, LSP plugins | Claude Code only | **Selective:** `skill-creator`, `pr-review-toolkit` (compare with `review-fanout` on one PR). `/plugin` shows the context cost of each. Nothing for Copilot or OpenCode. | user-local |
| [anthropics/skills](https://github.com/anthropics/skills) | docx/pdf/pptx/xlsx, frontend-design, mcp-builder, skill-creator; the spec | Claude Code, claude.ai, API | Reference for skill authoring; no overlap with the workflow skills. | via `/plugin` |
| [obra/superpowers](https://github.com/obra/superpowers) | 15 skills: TDD, brainstorming, writing-plans, subagent-driven-development, systematic-debugging; SessionStart bootstrap | Claude, Codex, Cursor, OpenCode, Copilot CLI | **Evaluate** (#96). Strongest overlap with `implementation` and `orch-pipeline`; cross-client. Opinionated process; bootstrap injected every session; no GitHub workflow. | spike |
| [github/awesome-copilot](https://github.com/github/awesome-copilot) | ~100 agents, skills, instructions, plugins (Gem Planner/Implementer/Reviewer, .NET agents) | Copilot CLI/VS Code; APM-installable | Cherry-pick single agents by path if ever needed; agents are verbose. | no |
| [wshobson/agents](https://github.com/wshobson/agents) | 94 plugins, 202 agents, 184 skills; one Claude source + adapters for Codex/Cursor/OpenCode/Copilot | Claude Code primary | Reference design for multi-client agent translation (what `apmw` does); far too large to adopt. | no |
| [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents), [davila7/claude-code-templates](https://github.com/davila7/claude-code-templates) | 100+ agents each | Claude Code | **No.** Every installed agent description sits in context each turn; generic prompts. | no |
| [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) | persona-based skills method (PM, architect, dev, test) | Claude Code, Codex, any skills client | **No.** Heavy ceremony, large context. | no |
| [vercel-labs/skills](https://github.com/vercel-labs/skills) (`npx skills add`) | skills-only distributor, ~80 clients | all | APM is the superset (agents, hooks, MCP, lockfile); no switch. | no |
| [agentskills.io](https://agentskills.io/specification) | the SKILL.md spec | all | Followed; client keys (`context`, `disable-model-invocation`) are allowed extensions. | yes |
| [microsoft/apm](https://github.com/microsoft/apm) | package manager: skills, agents, prompts, instructions, hooks, MCP; `apm.yml` dependencies with virtual paths and pins | Copilot, Claude, OpenCode, Cursor, Codex, Kiro, … | The distribution layer of this hub. Agents are copied verbatim per target, hence [apmw](https://github.com/GravionLabs/apmw). | yes |

## How to add an external pack

1. Find the smallest installable unit: a SKILL.md directory or a plugin directory, not a repo root
   (`angular/skills` root is not a package; `dotnet/skills` root installs everything).
2. Probe in a scratch directory: `apm install` with `targets: [claude]` and count the deployed
   `SKILL.md` and agent files. More than ~5 descriptions per pack needs a reason.
3. Pin the ref (`#<tag or sha>`), add the dependency to the package `apm.yml`, regenerate the lock.
4. Remove what the pack now covers from the own skill; keep project conventions and `## Review rules`.
