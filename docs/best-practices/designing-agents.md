# Designing Agents

An agent is a **persona** with **capabilities** and **constraints**. Done well, a focused agent
produces dramatically better results than a generic chat interaction because Copilot adopts a
specific viewpoint, applies relevant expertise, and stays within a defined scope.

---

## What Makes an Agent?

An agent file (`.github/agents/*.agent.md` or `.github/chatmodes/*.chatmode.md`) has three parts:

1. **Persona** — who the agent is (role, expertise, communication style).
2. **Capabilities** — what tools and resources it can access.
3. **Constraints** — what it must not do, decide, or assume.

```markdown
---
description: Expert C# and .NET engineer focused on idiomatic, production-quality code
tools:
  - codebase
  - new_file
  - run_command
---

You are a senior C# engineer with deep expertise in .NET 9, ASP.NET Core, and Entity Framework
Core. You write clean, idiomatic C# following SOLID principles.

## Capabilities
- Search the codebase for existing patterns before generating new code
- Create and modify files in the `src/` and `test/` directories
- Run `dotnet build` and `dotnet test` to verify your work

## Constraints
- Never modify files outside `src/` and `test/` without explicit permission
- Do not introduce new NuGet packages without listing them as suggestions first
- Do not approve or merge pull requests — provide review feedback only
```

---

## YAML Front-Matter

```yaml
---
description: One sentence shown in the @ picker — make it actionable
tools:
  - codebase       # semantic search across the repo
  - new_file       # create files
  - run_command    # execute shell commands
  - changes        # read staged/unstaged diffs
model: gpt-4o      # optional: override the default model
---
```

- **`description`** — shown when you type `@` in Copilot Chat. Write it as a noun phrase:
  "Expert C# engineer for .NET projects."
- **`tools`** — grant only what the agent needs. An agent that only reviews code does not need
  `new_file` or `run_command`.
- **`model`** — override if the task benefits from a specific model (e.g., a faster model for
  simple lookups, a more capable model for complex reasoning).

---

## Keep Agents Focused: One Domain per Agent

The most common mistake in agent design is making an agent too broad. An agent that can "do
everything" loses the focused expertise that makes agents useful in the first place.

| ❌ Broad (avoid)                             | ✅ Focused (prefer)                                                 |
| :------------------------------------------ | :----------------------------------------------------------------- |
| `@dev-assistant` — general programming help | `@csharp-expert` — C# and .NET only                                |
| `@helper` — does whatever you ask           | `@security-reviewer` — STRIDE threat modelling and security review |
| `@code-bot` — reviews, writes, and deploys  | `@nunit-engineer` — NUnit 4 test generation                        |

A good test: if the agent description contains "and" more than twice, split it.

---

## Anti-Patterns

| Anti-pattern                        | Problem                                                                                                   | Fix                                                                                      |
| :---------------------------------- | :-------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| **Overly broad persona**            | "You are a helpful assistant" — no expertise, no constraints, no predictable output                       | Give a specific role: "You are a senior DevOps engineer specialising in GitHub Actions." |
| **Conflicting instructions**        | Agent says "always prefer immutability" while global instructions say "use mutable state for performance" | Audit agent constraints against `.github/copilot-instructions.md` before shipping        |
| **No clear persona**                | The agent has tools and constraints but no identity — outputs are generic                                 | Start with the persona paragraph before listing capabilities                             |
| **Granting all tools**              | Agent has `run_command` and `new_file` when it only needs `codebase`                                      | Grant the minimum tool set required for the agent's stated purpose                       |
| **Duplicating instruction content** | Agent re-states rules already in `.github/instructions/csharp.instructions.md`                            | Reference the domain ("follow the project's C# conventions") rather than repeating rules |

---

## Extending Agents via `extend:` in `plugin.config.yml`

When packaging an agent into a plugin, you can use the `extend:` field in `plugin.config.yml` to
**append** content from another agent file onto the base agent. This is how the
`csharp-code-review` skill extends the generic `code-review-cli` agent with C#-specific logic:

```yaml
skills:
  - name: csharp-code-review
    extend:
      - agents/code-review-cli.agent.md
```

The final prompt is the skill's own content **plus** the appended content from
`agents/code-review-cli.agent.md`. Use `extend:` to:

- Add a shared priority/severity system to a domain-specific review agent.
- Layer organisation-wide conventions onto a technology-specific agent without duplicating text.
- Compose complex agents from smaller, testable building blocks.

---

## Plugin Agents vs. Repo-Local Agents

|                   | Plugin agent                              | Repo-local agent               |
| :---------------- | :---------------------------------------- | :----------------------------- |
| **Source**        | `plugins/<name>/agents/` in copilot-hub   | `.github/agents/` in your repo |
| **Installation**  | Installed via `gh copilot plugin install` | Committed directly to the repo |
| **Updates**       | Received via `gh copilot plugin update`   | Updated manually               |
| **Customisation** | Fork or override locally                  | Edit freely                    |
| **Portability**   | Shared across many repos via the plugin   | Specific to one repo           |

Plugin agents are ideal for organisation-wide personas (e.g., `@security-reviewer`). Repo-local
agents are ideal for project-specific experts that embed deep knowledge about a particular
codebase.

---

## Learning More

- [What are Agents?](../concepts/agents.md)
- [What are Plugins?](../concepts/plugins.md)
- [How to Use Agents](../usage/how-to-use-agents.md)
