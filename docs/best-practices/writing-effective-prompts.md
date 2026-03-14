# Writing Effective Prompts

A well-designed prompt produces consistent, high-quality output every time it is invoked. A
poorly-designed prompt yields responses that vary wildly with context. This guide shows you the
difference and gives you the tools to write prompts that work reliably.

---

## Core Principles

### 1. One Goal Per Prompt

A prompt that tries to scaffold, document, and test a feature in one pass does each task poorly.
Split responsibilities across multiple focused prompts.

|        | Example                                                                            |
| :----- | :--------------------------------------------------------------------------------- |
| ✅ Good | `create-dotnet-solution.prompt.md` — only scaffolds the solution structure         |
| ❌ Bad  | `setup-project.prompt.md` — scaffolds + adds CI + configures Docker + writes tests |

### 2. State the Expected Output Explicitly

Tell Copilot exactly what format you want the response in. Without guidance it will guess, and the
guess varies between runs.

```markdown
Return a single Markdown code block containing the complete `.github/workflows/nuget.yml` file.
Do not include any explanation outside the code block.
```

### 3. Use Constraints to Narrow the Solution Space

Constraints remove ambiguity and prevent Copilot from making arbitrary choices that contradict your
standards.

```markdown
Constraints:
- Target .NET 9
- Use `Microsoft.Extensions.Hosting` for the host builder — not `WebApplication`
- Do not include Swagger; OpenAPI is configured separately
- All public types must have XML documentation comments
```

---

## Use Placeholders for Reusability

Hardcoding values like solution names or feature names inside a prompt makes it a one-off script,
not a reusable tool. Use `{{variable}}` placeholders so the same prompt works for any project.

```markdown
---
description: Scaffold a new .NET solution
mode: agent
---

Create a .NET solution called **{{solution_name}}** with the following layout:

- `src/{{solution_name}}/` — main library project
- `test/{{solution_name}}.Tests/` — NUnit test project
- Root-level `Directory.Build.props` targeting .NET 9
```

When the user runs `/create-dotnet-solution`, Copilot asks:
> *solution_name?*

Common placeholder names:

| Placeholder         | Typical use                       |
| :------------------ | :-------------------------------- |
| `{{solution_name}}` | .NET solution or project name     |
| `{{feature_name}}`  | Feature or module being worked on |
| `{{entity_name}}`   | Domain entity for CRUD generation |
| `{{namespace}}`     | Root namespace for generated code |

---

## Good vs. Bad Examples

### Prompt body — instructions to Copilot

| ❌ Bad                     | ✅ Good                                                                                                                                                                                                 |
| :------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Help me with this code." | "Identify all potential null-reference exceptions in the selected method and suggest `ArgumentNullException.ThrowIfNull` guard clauses."                                                               |
| "Review this."            | "Review the selected C# file for violations of SOLID principles. For each violation, state the principle, explain why it is violated, and suggest a minimal refactoring."                              |
| "Write some tests."       | "Generate NUnit 4 unit tests for the `PaymentProcessor.ProcessAsync` method. Cover: happy path, `ArgumentNullException` for null input, and `InvalidOperationException` when balance is insufficient." |

### YAML front-matter

| ❌ Bad                              | ✅ Good                                                                             |
| :--------------------------------- | :--------------------------------------------------------------------------------- |
| No front-matter at all             | `description` field that summarises the prompt for the `/` picker                  |
| `mode: ask` for a scaffolding task | `mode: agent` so Copilot can create files via tools                                |
| No `tools` listed                  | `tools: [codebase, new_file, run_command]` to explicitly grant needed capabilities |

---

## Anti-Patterns

- **Vague verbs.** "Improve", "fix", "help", "update" mean different things to different people.
  Replace with "extract method", "add null guard", "rename parameter to match convention".
- **Mixing unrelated tasks.** Combining "generate tests" and "refactor the implementation" in one
  prompt forces Copilot to guess which takes priority when they conflict.
- **Restating instructions.** If a rule is in `.github/instructions/csharp.instructions.md`, don't
  repeat it in every prompt. Let the instructions system carry it.
- **Assuming context.** Don't write "as discussed earlier" — each prompt invocation starts fresh.
  Be explicit about what file, class, or method the prompt targets.

---

## When to Use a Prompt vs. an Instruction

| Situation                                               | Use             |
| :------------------------------------------------------ | :-------------- |
| "I want to enforce a rule on every chat response"       | **Instruction** |
| "I want to run a specific task on demand"               | **Prompt**      |
| "I find myself typing the same request every day"       | **Prompt**      |
| "I need Copilot to follow our naming convention always" | **Instruction** |
| "I need a scaffolding workflow for new microservices"   | **Prompt**      |

A useful rule of thumb: if you'd prefix it with "always" or "never", it belongs in instructions.
If you'd prefix it with "when I ask, do X", it belongs in a prompt.

---

## YAML Front-Matter Reference

```yaml
---
description: A short sentence shown in the slash-command picker
mode: agent          # agent | ask | edit
tools:
  - codebase         # search files and symbols
  - new_file         # create new files
  - run_command      # execute shell commands
  - changes          # read staged/unstaged diff
---
```

- **`description`** — shown in the `/` picker UI; make it action-oriented ("Scaffold a .NET
  solution").
- **`mode: agent`** — enables tool use so the prompt can create files, run commands, and search the
  codebase. Use for scaffolding and automation. Use `mode: ask` for read-only analysis.
- **`tools`** — explicitly declare what capabilities the prompt needs. Keeps the prompt safe and
  auditable.

---

## Learning More

- [What are Prompts?](../concepts/prompts.md)
- [How to Use Prompts](../usage/how-to-use-prompts.md)
- [Prompt Review Checklist](../checklists/prompt-review-checklist.md)
