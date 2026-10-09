## Agent Writing Rules

Use this reference when drafting or updating an `.agent.md` file.

### Load it when

- An agent file is being created or edited.
- You need guidance on frontmatter, body structure, tool minimalism, model selection, or cross-platform compatibility.
- Validating an agent before committing or distributing.

Do not load it when the task is unrelated to agent authoring.

---

### Naming and placement rules

- Filename: `<name>.agent.md`, kebab-case, 1-64 chars, matches `name` field exactly.
- No leading, trailing, or consecutive hyphens.
- Placement by platform and scope:

| Scope     | Copilot CLI / VS Code    | Claude Code              | opencode                    | Plugin                          |
|:----------|:-------------------------|:-------------------------|:----------------------------|:--------------------------------|
| Project   | `.github/agents/`        | `.claude/agents/`        | `.opencode/agents/`         | `packages/<domain>/.apm/agents/`|
| Global    | `~/.copilot/agents/`     | `~/.claude/agents/`      | `~/.config/opencode/agents/`| —                               |

Higher-priority locations win when multiple agents share the same `name`:
Managed settings > `--agents` CLI flag > project > global > plugin

---

### Frontmatter rules

- **Required cross-platform minimum:** `name`, `description`, `tools` (`model` is optional)
- `description`: one sentence, imperative, answers "when to use this agent" — this is shown in the @-picker
- `tools`: list format, minimal — grant only what the agent requires
- `model`: optional. Claude Code values: `sonnet`, `opus`, `haiku`, full model ID, or `inherit`; unset inherits the default model.
- `target`: **do not set** unless explicitly targeting one environment (`vscode` or `github-copilot`); omitting makes the agent available everywhere
- `infer`: **retired** — use `disable-model-invocation` instead

**Cross-platform `tools` aliases:**

| Capability           | Use in `tools:`                          |
|:---------------------|:-----------------------------------------|
| Read files           | `read`                                   |
| Search files/text    | `search`                                 |
| Semantic search      | `codebase`                               |
| Create/edit files    | `write`, `edit`, `editFiles`             |
| Execute shell        | `execute`, `shell`, `runCommands`        |
| Delegate to agent    | `agent` (CLI) / `runSubagent` (VS Code)  |
| Web fetch/search     | `web`, `WebFetch`, `WebSearch`           |
| GitHub MCP tools     | `github/*` or `github/<tool-name>`       |

Omit `tools` (or use `["*"]`) to grant all tools. Use `[]` to disable all tools.

**Platform-specific fields (use only when targeting that platform):**

| Platform     | Field              | Description                                                          |
|:-------------|:-------------------|:---------------------------------------------------------------------|
| Copilot CLI  | `user-invocable`   | `false` for sub-agents called by other agents, not users             |
| Copilot      | `disable-model-invocation` | `true` to prevent auto-invocation (replaces retired `infer`)  |
| Copilot Cloud| `mcp-servers`, `metadata` | Additional MCP servers / annotations; not used in VS Code or IDE agents |
| VS Code      | `target`           | `vscode` \| `jetbrains` \| `all`                                    |
| VS Code      | `argument-hint`    | Placeholder text shown in chat input                                 |
| Claude Code  | `permissionMode`   | `default` \| `acceptEdits` \| `bypassPermissions` \| `plan`         |
| Claude Code  | `maxTurns`         | Max agentic turns before stopping                                    |
| Claude Code  | `isolation`        | `shared` (default) or `isolated`                                     |
| Claude Code  | `disallowedTools`  | Tools the agent may NOT use (overrides `tools`)                      |
| Claude Code  | `color`            | Terminal color (`red`, `green`, `blue`, …)                           |

> For `all` platform targets: use cross-platform fields only. Platform-specific fields cause runtime failures on incompatible runtimes.
>
> **In this repo** agents are authored in Copilot style and platform-specific fields go under `metadata.<platform>` (`opencode`, `claude`); the generator injects them per target. See `AGENTS.md` → "Multi-target agent frontmatter".

---

### Body structure

Body must follow: **Persona → Capabilities → Constraints** (→ Behavior: optional)

1. **Persona** (≤ 3 sentences): who the agent is, area of expertise, communication style
2. **Capabilities** (bullet list): what the agent may access, create, execute, or delegate
3. **Constraints** (bullet list): what the agent must NOT do, access, or assume
4. **Behavior** (optional, bullets): specific rules beyond persona

Example skeleton:

```markdown
You are a [role] specializing in [domain]. [Communication style sentence].

## Capabilities
- May read and edit files in `src/`
- May run build and test commands

## Constraints
- Must not commit or push without explicit user confirmation
- Must not modify files outside `src/`
```

---

### Model guidance

Choose by *dominant task*, not worst case, and keep any body-level "Model hint" consistent with `model`. If unclear → load `references/model-selection.md`.

---

### Token-efficiency principles

Every token in an agent file is loaded into model context on every invocation.

- Prefer imperative bullets over prose paragraphs.
- Do not restate rules the agent already knows from `.github/copilot-instructions.md`.
- Move specs, examples, or tables longer than ~20 lines to `references/` files loaded conditionally.
- Use `If X → load references/Y.md; otherwise skip` for conditional loading.
- Keep reference chains one level deep (A → B, never A → B → C).

**Content placement:**

| Content type                              | Location                          |
|:------------------------------------------|:----------------------------------|
| Persona / capabilities / constraints      | Body                              |
| Stable specs, long tables, platform rules | `references/` (conditional load)  |
| Output templates > ~20 lines             | `assets/` (conditional load)      |

---

### Shell code blocks

- Use ` ```powershell ` — never ` ```bash ` or ` ```sh `.

---

### Anti-patterns

| Anti-pattern                                | Effect                                         |
|:--------------------------------------------|:-----------------------------------------------|
| Duplicating content from copilot-instructions | Redundant tokens on every invocation         |
| Over-granted tools (shell when only reading)| Unnecessarily wide permissions                 |
| Prose paragraphs instead of bullets         | Tokens wasted on filler words                  |
| Platform-specific fields for `all` target   | Runtime incompatibility                        |
| Reference chain > 1 level deep              | Hidden dependencies, hard to audit             |
| One agent with two unrelated responsibilities | Triggers incorrectly, body grows unwieldy    |

---

### Validation rules

- Filename matches `name` exactly.
- `description` is one sentence, imperative, answers "when to use".
- `tools` is minimal.
- `model` (if present) consistent with `references/model-selection.md`.
- Body follows Persona → Capabilities → Constraints (→ Behavior).
- No content duplicated from project-level instructions.
- All shell blocks use ` ```powershell `.
