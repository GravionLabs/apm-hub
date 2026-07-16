
# Agents


This document explains what **Agents** are in the context of **GitHub Copilot**, how they differ from prompts and instructions, and how to design, store, and use them in this repository.

> **Mental model**
>
> - **Instructions** → define the **rules** (persistent guidance)
> - **Agent** → defines the **role** (persona + allowed tools)
> - **Prompt** → defines the **task** (what to do right now)

---

## 1) What is an Agent?

An **Agent** is a **specialized persona** that Copilot can adopt.  
It determines *who* Copilot is acting as and *which capabilities/tools* it may use.

Typical examples:
- **Security Reviewer** – reads diffs/files, flags risks, proposes safe fixes
- **Test Engineer** – proposes test plan then generates focused, maintainable tests
- **Documentation Writer** – produces concise docs with examples and API summaries
- **Migration Assistant** – plans safe, stepwise migrations with rollback strategy

Agents are **not** task scripts. They don't encode a specific workflow (that's for prompts).  
Instead, they set **stable behavior and boundaries** for a role, which you can then combine with different prompts.

---

## 2) Types of Agents

### 2.1 Built‑in/context agents (mentions)

These agents attach **specific context** to the conversation and are invoked with `@` in Copilot Chat (IDE‑dependent). Examples include:

- `@workspace` – grants knowledge of the repository's codebase
- `@terminal` – includes terminal output/commands as context
- `@vscode` – uses editor diagnostics, active file, selections
- Other environment‑specific mentions (e.g., `@azure`, `@github`)

They **don't change** Copilot's persona; they **add context**.

### 2.2 Custom agents (user‑defined)

**Custom agents** are files in your repo that define:
- **Role/persona** (what the agent is)
- **Behavior** (how it should act)
- **Boundaries** (what it must *not* do)
- **Tools** (what it is allowed to use)

They can be selected in the chat UI and combined with prompts to perform a wide range of tasks within safe limits.

---

## 3) Where agents live

Agents can be stored at **project** or **global** scope:

| Scope       | Path                          | Availability                     |
| :---------- | :---------------------------- | :------------------------------- |
| **Project** | `.github/agents/*.agent.md`   | Current repository only          |
| **Global**  | `~/.github/agents/*.agent.md` | All repositories on this machine |

**Reusable templates in this repository:**

```text
templates/agents/*.agent.md
```

**Typical file name:**

```text
security-reviewer.agent.md
```

### Global path tool support

| Tool                   | Global agents path | Notes                      |
| :--------------------- | :----------------: | :------------------------- |
| VS Code (Copilot Chat) |         ✅          | Loaded automatically       |
| CLI (`gh copilot`)     |         ✅          | Available as `@agent-name` |
| JetBrains              |         ⬜          | Not supported              |

> For instructions on setting up global sharing and cross-machine sync, see [global-sharing.md](../sync/global-sharing.md).

---

## 4) When Should You Use an Agent?

Use an agent when you want to define a **long-term role or persona** rather than a single task.

✅ **Good agent use cases:**
- **Security Auditor:** Always looking for vulnerabilities and enforcing secure coding patterns.
- **Architect:** Reviewing designs against architectural principles and patterns.
- **Test Lead:** Planning test strategies and ensuring comprehensive coverage.
- **Onboarding Buddy:** Helping new developers understand the codebase and conventions.

❌ **Bad agent use cases:**
- **Single tasks:** "Explain this function" (use a prompt).
- **Global rules:** "Always use tabs for indentation" (use instructions).
- **Temporary context:** Adding one specific file to the conversation (use `@workspace` or `#file`).

---

## 5) Agent vs. Prompt vs. Instructions

| Concept          | Purpose                     | Scope         | Trigger      | Persistence |
| :--------------- | :-------------------------- | :------------ | :----------- | :---------- |
| **Instructions** | Define global rules         | Repository    | Automatic    | High        |
| **Agents**       | Define roles & capabilities | Session-level | Manual (`@`) | Medium      |
| **Prompts**      | Define a task               | Single action | Manual (`/`) | Low         |

---

## 6) Anatomy of an Agent File (`*.agent.md`)

An agent file consists of:
1. **YAML front-matter**: Defines metadata, capabilities, and tools.
2. **Body**: Defines the persona, behavior, and boundaries.

### Example:

```markdown
---
name: Security Auditor
description: Expert in identifying security risks and proposing safe fixes
tools:
  - file-search
  - code-review
---

You are a Senior Security Auditor. Your goal is to ensure all code changes meet the highest security standards.

### Behavior
- Analyze code for common vulnerabilities (OWASP Top 10).
- Suggest secure alternatives for risky patterns.
- Prioritize security over performance or brevity.

### Boundaries
- Do not approve changes; only provide feedback.
- Do not ignore potential risks, even if they seem minor.
```

### Key YAML Fields:
- `name`: The display name of the agent.
- `description`: A short summary shown in the UI.
- `tools`: (Optional) Specific capabilities the agent can access.

---

## 7) Designing Good Agents

A high-quality agent should:
- **Have a clear persona:** Define who the agent is and what its expertise is.
- **Define boundaries:** Explicitly state what the agent should *not* do.
- **Specify behavior:** Provide clear guidelines on how the agent should approach tasks.
- **Be complementary:** Ensure it works well with existing instructions and prompts.

---

## 8) Agents in This Repository

This repository contains:
- **Production-ready agents** under `templates/agents/`
- **Examples and usage** under `examples/agents/`
- **Best practices** in [designing-agents](../best-practices/designing-agents.md)

All agents are designed to provide specialized expertise while adhering to the repository's core principles of safety and clarity.

---

## 9) Multi-target Agents — Writing for Multiple Platforms

APM packages install agents to multiple AI platforms simultaneously: GitHub Copilot, Claude Code, and OpenCode. Each platform understands a **different subset of frontmatter fields**. A single source file must produce correct output for all of them.

### The problem

| Field         | Copilot | OpenCode | Claude Code |
| :------------ | :-----: | :------: | :---------: |
| `name`        |    ✅    |    ✅     |      ✅      |
| `description` |    ✅    |    ✅     |      ✅      |
| `tools`       |    ✅    |    ❌     |      ✅*     |
| `mode`        |    ✅    |    ❌     |      ❌      |
| `steps`       |    ✅    |    ❌     |      ❌      |
| `color`       |    ✅    |    ❌     |      ❌      |
| `permission`  |    ❌    |    ✅     |      ❌      |
| `user-invocable` |    ✅ |    ❌     |      ❌      |

*Claude Code uses different tool identifiers than Copilot (e.g. `Bash` vs `run_in_terminal`).

### The solution: `metadata:` blocks

Source agent files are written in **GitHub Copilot style** (primary format). For fields that differ per platform, add a `metadata:` block with nested platform keys. `apmw` and the apm-hub generator extract each platform's block and inject it into the compiled output for that target — the `metadata:` key itself is always stripped from all outputs.

```yaml
---
name: dev-workflow
description: "Dev workflow orchestrator."
# Copilot-native fields (stay in output for copilot; stripped by others)
mode: all
steps: 40
color: primary
tools: ['agent', 'read', 'search']
user-invocable: true
# Platform-specific overrides — injected per target, metadata: key stripped everywhere
metadata:
  opencode:
    permission:
      read: allow
      edit: deny
      glob: allow
      grep: allow
      bash:
        "*": deny
      task: allow
      skill: allow
      webfetch: allow
      question: allow
  claude:
    tools:
      - Bash
      - Read
      - Glob
      - Grep
      - WebFetch
      - Task
---

Agent body — identical on all platforms.
```

### What each platform receives after compilation

**`.github/agents/dev-workflow.agent.md`** (Copilot — unchanged, `metadata:` stripped):
```yaml
---
name: dev-workflow
description: "Dev workflow orchestrator."
mode: all
steps: 40
color: primary
tools: ['agent', 'read', 'search']
user-invocable: true
---
```

**`.opencode/agents/dev-workflow.md`** (`permission:` injected from `metadata.opencode`; Copilot fields stripped):
```yaml
---
name: dev-workflow
description: "Dev workflow orchestrator."
mode: all
steps: 40
color: primary
permission:
  read: allow
  edit: deny
  glob: allow
  grep: allow
  bash:
    "*": deny
  task: allow
  skill: allow
  webfetch: allow
  question: allow
---
```

**`.claude/agents/dev-workflow.md`** (Claude-native `tools:` injected from `metadata.claude`; incompatible fields stripped):
```yaml
---
name: dev-workflow
description: "Dev workflow orchestrator."
tools:
  - Bash
  - Read
  - Glob
  - Grep
  - WebFetch
  - Task
---
```

### Authoring rules

1. **Write the top level in Copilot style.** Copilot is the primary format; its fields are the default.
2. **Move non-Copilot fields into `metadata.<platform>`.** If a field is stripped from Copilot output, it should only exist under `metadata.<platform>`.
3. **`metadata` wins on conflict.** If `metadata.opencode` defines `permission:` and the top level also has one, the metadata version replaces it.
4. **`metadata:` is never in any output file.** The generator and `apmw` always strip it after extraction.
5. **Body is identical across all platforms.** Only frontmatter differs.

### OpenCode — `permission:` reference

| Key        | Values                                          | Notes                                       |
| :--------- | :---------------------------------------------- | :------------------------------------------ |
| `read`     | `allow` / `deny`                                | File read access                            |
| `edit`     | `allow` / `deny`                                | File write/edit access                      |
| `glob`     | `allow` / `deny`                                | File glob search                            |
| `grep`     | `allow` / `deny`                                | Content search                              |
| `bash`     | map of glob patterns → `allow`/`deny`           | Shell command access per pattern            |
| `task`     | `allow` / `deny`                                | Sub-agent spawning                          |
| `skill`    | `allow` / `deny`                                | Skill loading                               |
| `webfetch` | `allow` / `deny`                                | HTTP fetch                                  |
| `question` | `allow` / `deny`                                | Interactive question prompts                |

### Claude Code — `tools:` reference

Claude Code uses a distinct set of tool identifiers. Common ones for orchestrator agents:

| Tool name   | Purpose                         |
| :---------- | :------------------------------ |
| `Bash`      | Shell command execution         |
| `Read`      | Read files                      |
| `Write`     | Create / overwrite files        |
| `Edit`      | Patch existing files            |
| `Glob`      | File pattern search             |
| `Grep`      | Content search                  |
| `WebFetch`  | HTTP fetch                      |
| `Task`      | Spawn sub-agents                |
| `TodoWrite` | Task list management            |

### How compilation works

The apm-hub generator (`src/generators/agent-target-generator.ts`) and `apmw` implement the same three-step pipeline:

1. **Extract** — find `metadata.<platform>` in the source frontmatter and de-indent its content lines.
2. **Strip** — remove platform-incompatible fields (including `metadata:` itself) from the frontmatter.
3. **Inject** — append the extracted platform lines; if any injected field was already in the frontmatter, the injected version wins.

Both implementations are kept behaviorally identical. See [GravionLabs/apmw](https://github.com/GravionLabs/apmw) for the Python reference implementation.

---

## Further Reading

- [global-sharing.md](../sync/global-sharing.md) — How to share agents globally across all repositories
- [About custom agents](https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-custom-agents) — GitHub Docs: what custom agents are and how they work
- [Custom agents configuration reference](https://docs.github.com/en/copilot/reference/custom-agents-configuration) — GitHub Docs: full YAML frontmatter reference, tools, MCP servers
- [Copilot customization cheat sheet](https://docs.github.com/en/copilot/reference/customization-cheat-sheet) — GitHub Docs: comparison of agents vs. other customization options

