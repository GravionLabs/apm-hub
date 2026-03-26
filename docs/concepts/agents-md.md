# AGENTS.md

`AGENTS.md` is a **repository context document for AI coding assistants**. It gives tools like the GitHub Copilot CLI, Claude, and similar agents a structured overview of the repository so they can navigate, change, and extend the codebase without requiring repeated explanations.

> **Do not confuse it with `.agent.md`** — those are Copilot Chat personas. See the comparison table below.

---

## AGENTS.md vs .agent.md

|              | `AGENTS.md`                            | `.agent.md`                          |
| :----------- | :------------------------------------- | :----------------------------------- |
| **Purpose**  | Repository context for AI tools        | Copilot Chat persona / role          |
| **Location** | Repository root (like `README.md`)     | `.github/agents/`                    |
| **Reader**   | AI assistants (Copilot CLI, Claude, …) | GitHub Copilot Chat UI               |
| **Content**  | Structure, conventions, checklists     | Persona, behavior, boundaries, tools |
| **Trigger**  | Automatic — loaded at session start    | Manual — invoked via `@agent-name`   |

---

## When Should You Create an AGENTS.md?

Create an `AGENTS.md` when you want AI assistants to:

- Understand your repository structure without reading every file
- Follow your naming conventions and architectural patterns automatically
- Know which commands to run for building, testing, and linting
- Avoid common mistakes (e.g. editing auto-generated files)

An `AGENTS.md` is most valuable in **medium-to-large repositories** where the codebase structure is not self-evident and conventions are important.

---

## Anatomy of an AGENTS.md

A good `AGENTS.md` has a small set of mandatory sections and several optional ones.

### Mandatory

| Section                 | Purpose                                         |
| :---------------------- | :---------------------------------------------- |
| **Repository Snapshot** | One-paragraph description of what the repo does |
| **Repo Map**            | Annotated directory tree — what lives where     |
| **Key Conventions**     | Naming rules, patterns, architectural decisions |

### Recommended

| Section                   | Purpose                               |
| :------------------------ | :------------------------------------ |
| **Build & Test Commands** | Exact commands to build, test, lint   |
| **Safe Change Checklist** | Things to verify before committing    |
| **Architecture Notes**    | Patterns to follow, patterns to avoid |

### Optional

| Section                            | Purpose                                           |
| :--------------------------------- | :------------------------------------------------ |
| **Parameter / Naming Conventions** | Input/output naming rules for APIs, actions, etc. |
| **Technology Stack**               | Frameworks, versions, package managers            |
| **Out of Scope**                   | Files or directories the AI should not touch      |

---

## Example Structure

```markdown
# AGENTS.md

## Repository Snapshot

Brief description of what the repository does and who uses it.

## Repo Map

\```
src/
  feature-a/      — Description of feature A
  feature-b/      — Description of feature B
test/             — Unit and integration tests
docs/             — Documentation
\```

## Key Conventions

- Use kebab-case for file names
- All async methods end with `Async`
- Tests go in `test/` mirroring `src/` structure

## Build & Test Commands

\```bash
npm run build     # compile TypeScript
npm run test      # run unit tests
\```

## Safe Change Checklist

- Run tests before committing
- Do not edit files in `dist/` — they are auto-generated
```

---

## Best Practices

- **Keep it short.** Aim for 1–2 pages. AI tools read the whole file at session start.
- **Be precise.** Vague guidance ("follow good practices") is ignored. Specific commands and paths work.
- **Stay up to date.** An outdated `AGENTS.md` is worse than none — it misleads the AI.
- **Focus on what is non-obvious.** Don't describe what the directory names already say.
- **Use a checklist section.** A "Safe Change Checklist" prevents the most common mistakes.

---

## Available Templates

Choose the template that best matches your project type:

| Template                                                           | Best for                               |
| :----------------------------------------------------------------- | :------------------------------------- |
| [`generic.md`](../../templates/agents-md/generic.md)               | Any project — universal starting point |
| [`dotnet.md`](../../templates/agents-md/dotnet.md)                 | .NET / C# projects                     |
| [`node.md`](../../templates/agents-md/node.md)                     | Node.js / TypeScript projects          |
| [`python.md`](../../templates/agents-md/python.md)                 | Python projects                        |
| [`github-actions.md`](../../templates/agents-md/github-actions.md) | GitHub Actions / CI repositories       |

### Creating an AGENTS.md

**Option A — Copilot prompt** (auto-detects project type):

```
/create-agents-md
```

Requires the `copilot-workspace` plugin:

```bash
gh copilot plugin install copilot-workspace@copilot-hub
```

**Option B — PowerShell script** (copies a template):

```powershell
# From the copilot-hub scripts directory:
pwsh scripts/New-AgentsMd.ps1 -Type dotnet

# Or with a custom output path:
pwsh scripts/New-AgentsMd.ps1 -Type node -OutputPath ./my-project/AGENTS.md
```

---

## See Also

- [Agents (`.agent.md`)](agents.md) — Copilot Chat personas
- [Plugins](plugins.md) — how to install the `copilot-workspace` plugin
- [copilot-workspace Setup](../sync/copilot-workspace.md)
