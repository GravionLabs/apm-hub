# How to Use Instructions

Instructions are **persistent project rules** that Copilot loads automatically on every interaction.
You never invoke them manually — once they are in the right location, they are always active. Think
of them as a standing brief you hand to a new team member on day one.

---

## What Are Instructions?

Instructions tell Copilot about your project's conventions, constraints, and preferences so that
every suggestion already follows your standards without you having to repeat yourself.

Examples of things instructions encode:

- "Always use `async`/`await` — never raw `Task.ContinueWith`."
- "All public API surface in C# must have XML documentation comments."
- "Never store secrets in `appsettings.json`."
- "Use NUnit 4 with `Assert.That` — not the legacy constraint-less overloads."

---

## File Locations

### Repository-wide (global)

```
.github/copilot-instructions.md
```

This single file applies to **every** Copilot interaction in the repository. Use it for
organisation-wide or project-wide rules that are relevant regardless of which file is open.

### Scoped instructions

```
.github/instructions/*.instructions.md
```

Each file in this directory can carry a YAML front-matter `applyTo` glob. Copilot only includes the
file in its context when the active file matches the glob. This keeps the context window lean and
avoids noisy rules that don't apply to the current task.

---

## YAML Front-Matter: Scoping with `applyTo`

```yaml
---
applyTo: "**/*.cs"
---
```

Place this at the top of any `.instructions.md` file. Copilot activates the file only when you are
editing a file whose path matches the glob.

**Practical examples:**

| `applyTo` glob | When it activates                       |
| :------------- | :-------------------------------------- |
| `**/*.cs`      | Any C# file                             |
| `test/**/*.cs` | Only files inside the `test/` directory |
| `src/**/*.ts`  | TypeScript files under `src/`           |
| `**/*.tf`      | Terraform files anywhere in the repo    |
| *(omitted)*    | Always active (same as the global file) |

---

## Practical Example: Security Rules for TypeScript

**Goal:** Enforce OWASP-aligned security practices on all TypeScript files.

1. Create `.github/instructions/typescript-security.instructions.md`:

```markdown
---
applyTo: "**/*.ts"
---

## Security Rules — TypeScript

- Never concatenate user input directly into SQL queries; always use parameterised queries.
- Do not `eval()` or `new Function()` with dynamic input.
- Sanitise all data read from `process.env` before use.
- Use `crypto.randomUUID()` for identifier generation — never `Math.random()`.
- Import external packages only from the `dependencies` section of `package.json`; do not use CDN
  URLs at runtime.
```

2. Commit the file. No further configuration needed — Copilot picks it up automatically when any
   `.ts` file is open.

---

## How Plugin Instructions Work

When you install a plugin (e.g., `gh copilot plugin install csharp-development@copilot-hub`), the
plugin's bundled instruction files are copied into your repository's `.github/instructions/`
directory as part of the installation step.

For example, installing `csharp-development` copies:

```
.github/instructions/csharp.instructions.md          # applyTo: "**/*.cs"
.github/instructions/csharp-nunit.instructions.md    # applyTo: "test/**/*.cs"
.github/instructions/playwright-dotnet.instructions.md
```

These files then behave like any other scoped instruction — you can edit them locally to adapt the
rules to your team, and they remain version-controlled in your repository.

---

## Tips for Effective Use

- **Keep rules short and declarative.** Each rule should fit on one line: "Always X" or "Never Y".
  Long explanations belong in project documentation, not instructions.
- **Prefer directives over suggestions.** Write "Use `readonly` fields where possible" not "You
  might want to consider using `readonly` fields in some situations".
- **Avoid large code blocks.** Embedding multi-line code examples inflates the context window
  unnecessarily. Reference a file path or pattern name instead.
- **Scope aggressively.** Put C#-only rules in a `**/*.cs`-scoped file, not in the global
  instructions. Scoping keeps each rule relevant and avoids confusing Copilot in unrelated files.
- **Check for contradictions.** If the global instructions say "prefer interfaces" and a scoped
  file says "avoid abstract types", Copilot will receive conflicting signals. Audit periodically.

---

## Learning More

- [What are Instructions?](../concepts/instructions.md)
- [What are Plugins?](../concepts/plugins.md)
- [Writing Good Instructions](../best-practices/writing-good-instructions.md)
- [Instruction Review Checklist](../checklists/instructions-review-checklist.md)
