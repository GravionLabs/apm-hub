## Frontmatter Schema

All fields appear as YAML frontmatter at the top of `SKILL.md`, enclosed in `---` delimiters.

### Required fields

| Field | Max length | Rules |
|-------|-----------|-------|
| `name` | 64 chars | Kebab-case only (`a-z`, `0-9`, `-`). Must match the parent directory name exactly. No leading, trailing, or consecutive hyphens (`--`). |
| `description` | 1,024 chars | Imperative phrasing. Must describe **what** the skill does and **when** to activate it. Include specific trigger keywords. |

### Optional fields

| Field | Max length | Rules |
|-------|-----------|-------|
| `license` | — | SPDX identifier (e.g. `MIT`) or reference to a bundled file. |
| `compatibility` | 500 chars | Only when the skill has specific environment requirements (OS packages, runtimes, network access). |
| `metadata` | — | Flat map of string key-value pairs. Prefix keys with an org/team name to avoid conflicts. |
| `allowed-tools` | — | Space-separated tool identifiers. ⚠️ Only pre-approve `shell`/`bash` if **all** bundled scripts are fully reviewed and trusted. |

### `name` validation rules

- Pattern: `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`
- 1–64 characters
- Must exactly match the parent directory name
- No consecutive hyphens (`my--skill` is invalid)
- No leading or trailing hyphens

### `description` quality rules

Use the `>` folded scalar for any description spanning more than one sentence:

```yaml
description: >
  Does X. Use this skill when the user needs to Y or Z — even if they
  do not explicitly mention X.
```

### Three-part description formula

Write descriptions following: **[What it does]** + **[When to use it]** + **[Key capabilities / indirect triggers]**

| Part | Rule | Example |
|------|------|---------|
| **What it does** | One sentence: action the skill performs | "Debugs failing GitHub Actions workflows." |
| **When to use it** | Imperative: "Use this skill when…" | "Use this skill when asked to fix CI/CD failures…" |
| **Key capabilities** | Keywords and indirect triggers | "…even if the user does not mention GitHub Actions." |

### `description` quality rules

1. Use `>` folded scalar — required for multi-sentence descriptions
2. Use imperative phrasing: "Use this skill when…" rather than "This skill does…"
3. Describe specific scenarios and contexts, not just the domain name
4. Include indirect trigger phrasing: "even if the user does not mention X explicitly"
5. Stay under 1,024 characters
6. Do not make it so broad that the skill activates for unrelated tasks

### `allowed-tools` known values

Tool names are platform-specific. Use the **primary alias** where possible — each platform picks what it recognises and silently ignores the rest. See [GitHub Copilot — Tool aliases](https://docs.github.com/en/copilot/reference/custom-agents-configuration#tool-aliases).

| Identifier | Platform | Purpose |
|-----------|----------|---------|
| **`execute`** | Cloud Agent (primary alias) | Execute shell commands; compatible aliases: `shell`, `Bash` |
| **`read`** | Cloud Agent (primary alias) | Read file contents; compatible alias: `Read` |
| **`edit`** | Cloud Agent (primary alias) | Edit/create files; compatible aliases: `Edit`, `Write` |
| **`search`** | Cloud Agent (primary alias) | Search files/text; compatible aliases: `Grep`, `Glob` |
| **`web`** | Cloud Agent (primary alias) | Fetch URLs / web search |
| `shell` | Copilot CLI (permission kind) | Shell commands (also Cloud Agent alias for `execute`) |
| `write` | Copilot CLI (permission kind) | File write access (also Cloud Agent alias for `edit`) |
| `codebase` | VS Code Copilot | Semantic codebase search |
| `editFiles` | VS Code Copilot | Create and edit files |
| `runCommands` | VS Code Copilot | Execute terminal commands |
| `mcp_github_*` | All platforms | GitHub MCP server tools (wildcard) |

**For all three targets (Cloud Agent + Copilot CLI + VS Code):**

```
execute read edit search codebase editFiles runCommands
```

### Minimal valid frontmatter

```yaml
---
name: my-skill
description: >
  Does X. Use this skill when the user needs to Y or Z — even if they
  do not explicitly mention X.
---
```

### Further reading

- [agentskills.io](https://agentskills.io/home)
- [Specification — description field](https://agentskills.io/specification#description-field)
- [Optimizing descriptions](https://agentskills.io/skill-creation/optimizing-descriptions)
- [Best practices](https://agentskills.io/skill-creation/best-practices)
- [GitHub Copilot — About agent skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills)
