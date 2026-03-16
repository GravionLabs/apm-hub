# How to Use Agents

Agents in GitHub Copilot allow you to switch between different expert personas and sets of capabilities. This guide explains how to invoke and interact with them.

---

## 1. Invoking Agents (Mentions)

In the Copilot Chat window, invoke an agent using the `@` symbol followed by the agent's name.

- **Built-in agents:** `@workspace`, `@terminal`, `@github`
- **Custom repo agents:** defined in `.github/agents/` (e.g. `@security-reviewer`)
- **Plugin-installed:** installed via `gh copilot plugin install` — available exactly like custom agents
- **Scripts:** standalone automation like `copilot-sync.ps1` in `.github/scripts/` (see [Sync Configuration](../sync/copilot-workspace.md))

**Example:**
```
@csharp-expert explain the async pattern used in this service
@security-reviewer review this authentication flow
```

---

## 2. Where Agents Come From

There are three sources for agents:

| Source           | Location                    | How to add                           |
| :--------------- | :-------------------------- | :----------------------------------- |
| Built-in         | GitHub Copilot              | Always available                     |
| Repo-local       | `.github/agents/*.agent.md` | Copy from `templates/agents/`        |
| Plugin-installed | Copilot CLI plugin          | `gh copilot plugin install <plugin>` |

**Plugin agents** are the easiest way to get domain-specific experts without manually copying files:

```bash
gh copilot plugin marketplace add GravionLabs/copilot-hub
gh copilot plugin install csharp-development@copilot-hub
# → @csharp-expert, @nunit-engineer, @api-architect, ... are now available
```

---

## 3. Selecting Agents via UI

Most IDEs also provide a dropdown or selection menu in the Chat interface to choose an active agent without typing `@`.

1. Look for the agent icon or name at the top of the Chat window.
2. Click it to see a list of available agents.
3. Select the one you want for the current session.

---

## 4. Combining Agents with Prompts

One of the most powerful patterns is combining agents with slash-command prompts:

```
@csharp-expert /create-dotnet-solution
@security-reviewer /review-ci-workflow
```

This directs the agent's expertise at a specific task workflow.

---

## 5. Best Practices

- **Use `@workspace` for broad questions** that need full project context.
- **Use specialized agents for focused tasks** — e.g. `@nunit-engineer` when writing tests.
- **Combine with skills**: `@csharp-expert /csharp-code-review` gives you a domain expert running a structured review.
- **Start a new chat session** when switching to a significantly different topic to avoid context bleed.

---

## 6. Discovering Available Agents

```bash
# See all agents from installed plugins
gh copilot plugin list

# Or browse the hub
gh copilot plugin marketplace browse copilot-hub
```

Repo-local agents live in:
```
.github/agents/*.agent.md
```

---

## 7. Learning More

- [What are Agents?](../concepts/agents.md)
- [Plugins — how agents are bundled](../concepts/plugins.md)
- [Designing Good Agents](../best-practices/designing-agents.md)
- [Available Plugins](../plugin-list.md)
