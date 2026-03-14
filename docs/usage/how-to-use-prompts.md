# How to Use Prompts

Prompts are **explicitly invoked, task-specific instructions** that tell Copilot exactly what to do
for a single interaction. Unlike instructions (which run automatically in the background), you choose
when to run a prompt and for what purpose.

---

## What Are Slash-Command Prompts?

Prompt files are Markdown files stored at `.github/prompts/*.prompt.md` in your repository.
GitHub Copilot exposes each file as a **slash command** in Copilot Chat — the filename (without the
`.prompt.md` extension) becomes the command name.

```
.github/prompts/create-dotnet-solution.prompt.md  →  /create-dotnet-solution
.github/prompts/csharp-code-review.prompt.md      →  /csharp-code-review
```

Prompts in this repository live in `templates/prompts/` and are copied (or installed via a plugin)
into your project's `.github/prompts/` directory.

---

## Invoking a Prompt

1. Open **Copilot Chat** in VS Code (or your supported IDE).
2. Type `/` — a picker appears listing every available prompt, including your local
   `.github/prompts/` files and any slash commands contributed by installed plugins.
3. Select or type the command name, for example `/create-dotnet-solution`.
4. Copilot runs the prompt, pausing at any placeholders to ask for input.

```
/create-dotnet-solution
```

> **Tip:** You can combine a prompt with an `@agent` mention. For example,
> `@csharp-expert /csharp-code-review` runs the review prompt through the C# expert agent for more
> targeted feedback.

---

## Prompts vs. Instructions

|              | Prompts                                           | Instructions                                                                  |
| :----------- | :------------------------------------------------ | :---------------------------------------------------------------------------- |
| **Trigger**  | Manual — you type `/command`                      | Automatic — always active                                                     |
| **Scope**    | One interaction                                   | Every interaction                                                             |
| **Purpose**  | Task-specific action (generate, review, scaffold) | Persistent project rules (style, conventions)                                 |
| **Location** | `.github/prompts/*.prompt.md`                     | `.github/copilot-instructions.md` or `.github/instructions/*.instructions.md` |

Use a **prompt** when you need Copilot to perform a specific, repeatable task on demand.
Use an **instruction** when you need a rule applied automatically to every response.

---

## Using Input Placeholders

Prompts can contain `{{variable}}` placeholders (or `${input:name:description}` in some tooling).
When Copilot encounters a placeholder, it either pauses to ask you to fill it in or resolves it
from selected context.

**Example — `/create-dotnet-solution`:**

The prompt file might contain:

```markdown
---
description: Scaffold a new .NET solution with src/ and test/ projects
mode: agent
---

Create a new .NET solution called **{{solution_name}}**.

Requirements:
- Solution file at the root
- `src/{{solution_name}}/` — main class library project
- `test/{{solution_name}}.Tests/` — NUnit test project
- Include a global `Directory.Build.props` and `.editorconfig`
```

When you run `/create-dotnet-solution`, Copilot will ask:
> *What is the solution name?*

You answer `Gravion.Payments`, and Copilot scaffolds the full structure for you.

---

## Plugin Skills vs. Local Prompts

When you install a plugin (e.g., `gh copilot plugin install csharp-development@copilot-hub`), its
**skills** (prompts) are registered as additional slash commands. These appear in the same `/`
picker alongside your local prompts:

| Source       | Example command           | Where it lives after install      |
| :----------- | :------------------------ | :-------------------------------- |
| Local file   | `/my-custom-prompt`       | `.github/prompts/`                |
| Plugin skill | `/create-dotnet-solution` | Registered by the plugin manifest |

Plugin skills and local prompt files behave identically from a user perspective — both appear in the
`/` picker and accept the same placeholders.

---

## Practical Tips

- **Be specific.** `/create-dotnet-solution` beats `/set up a project`. Precise commands produce
  precise output.
- **Use `@agent` for context.** Pairing `@csharp-expert /csharp-code-review` means the review
  follows C# conventions. Pairing `@workspace /csharp-code-review` means the agent can traverse the
  full repo for context.
- **Build a library for repetitive tasks.** If you find yourself typing the same instructions
  repeatedly, extract them into a prompt file and commit it to `.github/prompts/`.
- **Let agents extend prompts.** Set `mode: agent` in the YAML front-matter so Copilot can call
  tools (file search, terminal) as part of the prompt execution rather than just generating text.
- **Chain prompts.** Run `/create-dotnet-solution` to scaffold, then `/aspnet-minimal-api-openapi`
  to add an API layer on top.

---

## Learning More

- [What are Prompts?](../concepts/prompts.md)
- [What are Plugins?](../concepts/plugins.md)
- [Writing Effective Prompts](../best-practices/writing-effective-prompts.md)
- [Prompt Review Checklist](../checklists/prompt-review-checklist.md)
