---
name: agent-update
description: >
  Applies improvements from an agent audit. Invoked automatically by
  agent-audit after user confirmation, or can be called standalone when audit
  findings are ready to be applied to an existing agent.
allowed-tools: execute shell runCommands read write edit editFiles search codebase
---

## Overview

Apply audit findings in severity order and keep the change set focused.

When invoked from `agent-audit`, findings are passed in context. When called standalone, invoke `agent-audit` first to get findings in context.

## Prerequisites

- Agent path (`.agent.md` file or containing directory)
- Findings in context from `agent-audit` (run `agent-audit` first if not already done)

## Instructions

1. **Get findings:** Use findings from context. If not available, invoke `agent-audit` on the agent path first.
2. Read the `.agent.md` file.
3. Fix issues in severity order (critical → important → suggestions). Use skill `agent-write` when rewriting or restructuring agent content.
4. Use this mapping:

   | Finding | Fix |
   |:--------|:----|
   | Name mismatch | Update `name` or rename the file. |
   | Description issue | Make it imperative, one sentence, specific to the agent's role. |
   | Over-granted tools | Remove tools the agent doesn't require; keep the minimal set. |
   | Platform-specific fields on `all` target | Remove the platform-specific fields. |
   | Body too long | Move specs, tables, or templates to `references/` or `assets/`. |
   | Prose instead of bullets | Convert Capabilities/Constraints to bullet lists. |
   | Duplicated project instructions | Remove content already covered by `.github/copilot-instructions.md`. |
   | Missing body sections | Add Persona, Capabilities, or Constraints as needed. |
   | Wrong shell in code block | Replace ` ```bash ` / ` ```sh ` with ` ```powershell `. |
   | Reference issue | Use relative, conditional loads; keep chains one level deep. |
   | Vague or generic content | Tighten or remove it. |

5. Validate the result.

## Gotchas

- Confirm before any file rename or location move.
- Do not widen the scope beyond the audit findings.
- Ask before large restructures.
