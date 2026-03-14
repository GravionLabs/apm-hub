# Writing Good Instructions

Instructions are the foundation of consistent Copilot behaviour in your repository. Because they
are injected into every interaction, the cost of a bad instruction is paid on every request.
This guide shows you how to write instructions that are clear, focused, and stable.

---

## Core Principles

### 1. Keep Instructions Short and Declarative

Every line in your instruction file occupies context-window space on every Copilot interaction.
Write rules in the imperative — direct, one-line commands. Avoid explanations, history, or
rationale.

| ❌ Bad                                                                                                                                                                                             | ✅ Good                                                                      |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------- |
| "In our project we have historically found that raw `Task` continuation chains are hard to read and maintain, so we decided a while ago to standardise on async/await for all asynchronous code." | "Always use `async`/`await`. Never use `Task.ContinueWith`."                |
| "We prefer to use the `readonly` keyword on fields where it makes sense to do so."                                                                                                                | "Declare fields `readonly` unless mutation after construction is required." |
| "It is generally a good practice to avoid magic numbers in your code."                                                                                                                            | "Never use magic numbers; extract them as named constants."                 |

### 2. Use "Always" / "Never" Language

Clear directives remove ambiguity. Copilot responds well to absolute rules.

```markdown
Always annotate public API surface with XML documentation comments.
Never suppress nullable warnings with `!` (null-forgiving operator) without a comment explaining why.
Always throw `ArgumentNullException.ThrowIfNull` at the start of public methods.
```

### 3. Scope Aggressively

Do not put everything in `.github/copilot-instructions.md`. Use scoped files with `applyTo` to
restrict rules to the files where they are relevant.

| Rule                    | Scope it to                          |
| :---------------------- | :----------------------------------- |
| C# naming conventions   | `applyTo: "**/*.cs"`                 |
| NUnit test conventions  | `applyTo: "test/**/*.cs"`            |
| TypeScript import style | `applyTo: "**/*.ts"`                 |
| Terraform naming        | `applyTo: "**/*.tf"`                 |
| General security policy | *(global file — applies everywhere)* |

---

## Repository-Wide vs. Scoped Instructions

### Global (`.github/copilot-instructions.md`)

Use for rules that apply across the entire codebase regardless of language or technology:

- Security and secrets policies
- PR and commit message conventions
- Documentation language and tone
- Prohibited third-party libraries

### Scoped (`.github/instructions/*.instructions.md`)

Use for technology-specific or role-specific rules that would be noise elsewhere:

```yaml
---
applyTo: "test/**/*.cs"
---

## NUnit Test Guidelines

Always use `Assert.That` with constraint model — never classic `Assert.AreEqual`.
Test method names must follow the pattern: `MethodName_StateUnderTest_ExpectedBehaviour`.
Each test class must have exactly one `[TestFixture]` attribute.
Do not use `Thread.Sleep`; use `Task.Delay` with `CancellationToken`.
```

---

## Anti-Patterns

| Anti-pattern                           | Why it's a problem                                                       | Fix                                                                       |
| :------------------------------------- | :----------------------------------------------------------------------- | :------------------------------------------------------------------------ |
| **Large code blocks**                  | Inflate context window; Copilot may treat them as reference code to emit | Reference a file path or describe the pattern in prose                    |
| **Contradictory rules**                | Copilot receives conflicting signals and produces inconsistent output    | Audit all instruction files for conflicts when adding new rules           |
| **Too many rules**                     | Dilutes the importance of critical rules; increases context cost         | Keep each scoped file under 30 lines; split into multiple files if needed |
| **Why instead of what**                | Background narrative wastes tokens                                       | State the rule only; omit motivation                                      |
| **Global rules that should be scoped** | Rules for one technology appear in responses for unrelated files         | Move to a scoped `*.instructions.md` with `applyTo`                       |

---

## Good vs. Bad Examples

### ❌ Bad instruction file (global, verbose, mixed concerns)

```markdown
We use C# in our backend. Please make sure to use async/await. Also, in our frontend TypeScript
code, we don't want you to use `any`. For tests, we use NUnit. We have a React frontend.
Don't forget to document your methods. The team likes clean code.
```

Problems: mixes C#, TypeScript, and NUnit in one global file; verbose; no clear directives.

### ✅ Good — three focused, scoped files

`.github/copilot-instructions.md` (global):
```markdown
All public-facing APIs must be documented before merging.
Never store credentials, connection strings, or API keys in source files.
Use British English in all user-facing text.
```

`.github/instructions/csharp.instructions.md`:
```yaml
---
applyTo: "**/*.cs"
---

Always use `async`/`await` — never `Task.ContinueWith` or `.Result`.
Public types and members must have XML documentation comments.
Use `ArgumentNullException.ThrowIfNull` at the entry point of public methods.
Prefer `IReadOnlyList<T>` over `List<T>` for return types.
```

`.github/instructions/typescript.instructions.md`:
```yaml
---
applyTo: "src/**/*.ts"
---

Never use `any`; use `unknown` and narrow the type explicitly.
Always declare return types on exported functions.
Use `const` for all variable declarations unless reassignment is required.
```

---

## Testing That Instructions Are Applied

After adding or updating an instruction file:

1. Open a file that matches the `applyTo` glob (or any file for global instructions).
2. Ask Copilot a question that would normally violate your new rule.
   - Example: "Write a method that reads a file synchronously." (should be blocked by an async rule)
3. Verify that Copilot's response follows the instruction.
4. If not, check:
   - Is the file in the correct location (`.github/instructions/`)?
   - Is the `applyTo` glob correct for the current file?
   - Does the rule contradict another active instruction?

---

## Learning More

- [What are Instructions?](../concepts/instructions.md)
- [How to Use Instructions](../usage/how-to-use-instructions.md)
- [Instruction Review Checklist](../checklists/instructions-review-checklist.md)
