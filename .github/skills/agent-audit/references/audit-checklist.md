## Agent Audit Checklist

Use this checklist when auditing an `.agent.md` file. Apply all checks and report findings by severity.

### Severity levels

- 🔴 **Critical** — Invalid agent; will fail validation or behave incorrectly
- 🟡 **Important** — Significant quality issue; reduces reliability or activates incorrectly
- 🟢 **Suggestion** — Improvement that increases quality without being strictly necessary

---

### Location check

**Agent placement (🟢 if misplaced):**

- [ ] Agent is in `.github/agents/` (project, CLI/VS Code), `.claude/agents/` (project, Claude Code), or `packages/<domain>/.apm/agents/` (plugin)
- [ ] If in `.github/agents/`: confirm the file targets CLI/VS Code — 🟢 if it's Claude-only and should be in `.claude/agents/`

---

### Frontmatter checks

**`name` field (🔴 if absent, 🟡 if malformed):**

- [ ] Field is present
- [ ] Matches the filename exactly (e.g. `name: my-agent` → file is `my-agent.agent.md`)
- [ ] 1–64 characters
- [ ] Only `a-z`, `0-9`, `-` (no uppercase, no underscores, no spaces)
- [ ] Does not start or end with a hyphen
- [ ] No consecutive hyphens (`--`)

**`description` field (🔴 if absent, 🟡/🟢 for quality):**

- [ ] Field is present
- [ ] One sentence shown in the @-picker (imperative, not prose)
- [ ] Answers "when should I use this agent?" — 🟡 if vague or missing context
- [ ] Describes specific expertise, not just a broad domain — 🟡 if too general

**`tools` field (🟡 if overly broad):**

- [ ] Present (or deliberately omitted for full access)
- [ ] Minimal — grants only what the agent's role requires
- [ ] Does not include shell execution (`execute`, `shell`, `runCommands`) unless the agent actually runs commands — 🟡 if pre-approved without justification
- [ ] Cross-platform alias coverage (if platform-specific use, flag as 🟢 suggestion to add counterpart):
  - `read` present but `search` absent → add `search`
  - `edit` or `write` present but `editFiles` absent → add `editFiles` for VS Code — 🟡
  - `editFiles` present but `edit` absent → add `edit` for Cloud Agent — 🟡
  - `execute` present but `runCommands` absent → add `runCommands` for VS Code — 🟡

**`model` field (🟢 if omitted, 🟡 if misleading):**

- [ ] Treat `model` as a repo-local convention, not an officially required field
- [ ] If present, value matches a model listed in `docs/model-overview.md` — 🟡 if unrecognized
- [ ] If present, fits the agent's dominant task (mechanical → `gpt-4.1`; complex → `claude-sonnet-4.6`) — 🟡 if unjustified
- [ ] If a body-level "Model hint" exists, it is consistent with frontmatter `model` — 🟡 if they conflict

**Platform-specific field safety (🔴 if misused):**

- [ ] If target is `all` or multi-platform: no platform-specific fields (`user-invocable`, `permissionMode`, `target`, `argument-hint`) — 🔴 if present
- [ ] `user-invocable: false` only set for agents that are sub-agents, not user-facing
- [ ] `permissionMode: bypassPermissions` only in trusted automated contexts — 🟡 otherwise

---

### Body checks

**Structure (Persona → Capabilities → Constraints):**

- [ ] Has a Persona section (≤ 3 sentences) — 🟡 if missing or > 5 sentences
- [ ] Has a Capabilities section (bullet list) — 🟡 if missing
- [ ] Has a Constraints section (bullet list) — 🟡 if missing
- [ ] Behavior section (optional) uses imperative bullets, not prose — 🟢

**Content quality:**

- [ ] No prose paragraphs where bullets would suffice — 🟡
- [ ] No content duplicated from `.github/copilot-instructions.md` — 🟡
- [ ] No content the agent already knows (generic tool usage, HTTP basics) — 🟡
- [ ] No vague advice ("handle errors appropriately") — 🟡
- [ ] Shell code fences use ` ```powershell ` (not ` ```bash ` or ` ```sh `) — 🔴 if wrong shell

**Length:**

- [ ] Body < 200 lines — 🟡 if exceeded; move details to `references/`
- [ ] No specs, long tables, or output templates inline — move to `references/` or `assets/` — 🟢

---

### `references/` checks (if present)

- [ ] Each reference file has a conditional load instruction in the agent body ("If X, load references/Y.md") — 🟡
- [ ] File paths are relative — 🔴 if absolute
- [ ] No reference chains deeper than one level (A → B → C) — 🟡

---

### `assets/` checks (if present)

- [ ] Assets are referenced conditionally, not auto-loaded — 🟡
- [ ] Assets contain templates or data, not prose documentation — 🟢

---

### Anti-pattern checks

| Anti-pattern                                             | Severity | Detection                                          |
|:---------------------------------------------------------|:---------|:---------------------------------------------------|
| Two unrelated responsibilities in one agent              | 🟡       | Description needs "and" more than twice            |
| Generic agent with no project context                    | 🟡       | Body applies to any project without changes        |
| Platform-specific fields used with `all` target          | 🔴       | `user-invocable` or `permissionMode` + multi-platform |
| Over-granted tools (shell when only reading)             | 🟡       | `execute`/`shell` present; no commands in body     |
| Prose paragraphs instead of bullets                      | 🟡       | Capabilities/constraints written as sentences      |
| Duplicating project-level instructions                   | 🟡       | Content mirrors `.github/copilot-instructions.md`  |

---

### Quick-reference summary

```
[ ] location: .github/agents/ (CLI/VS Code) OR .claude/agents/ (Claude) OR packages/<domain>/.apm/agents/ (plugin)
[ ] name: present, kebab-case, 1-64 chars, matches filename, no leading/trailing/consecutive hyphens
[ ] description: present, one sentence, imperative, answers "when to use"
[ ] tools: minimal, cross-platform aliases present if needed
[ ] model: optional; if present, repo-local, aligned with docs/model-overview.md
[ ] body: Persona → Capabilities → Constraints (→ Behavior)
[ ] body: no prose paragraphs, no duplicated project instructions
[ ] shell code fences: ```powershell only (not ```bash or ```sh)
[ ] platform-specific fields: only when targeting that specific platform
[ ] references: conditional load instructions, relative paths, one level deep
[ ] assets: referenced conditionally, not auto-loaded
```
