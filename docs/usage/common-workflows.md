# Common Workflows

End-to-end scenarios with apm-hub skills. Each one starts from a repository where the APM CLI is installed and the marketplace is registered (see the [README](../../README.md#-quick-start)). Prompts are shown as you would type them in Copilot, Claude Code or OpenCode; the agent selects the skills by their descriptions, so naming them is optional.

---

## Workflow 1: Set up a .NET repository

```bash
apm install dotnet@apm-hub
apm install shared@apm-hub
```

1. **Scaffold the solution**

   ```text
   Use dotnet-create-solution to create a NuGet library called Gravion.Payments.
   ```

   The skill asks for library vs. application and the project template, then runs its script. You get `src/`, `test/`, `Directory.Build.props`, `Directory.Packages.props` (Central Package Management) and `.editorconfig`.

2. **Implement with tests**

   ```text
   Implement a PaymentProcessor that validates IBANs.
   ```

   `implementation` loads `dotnet-implementation` and `dotnet-test`: every change comes with NUnit tests using NSubstitute and Shouldly.

3. **Review before committing**

   ```text
   Review the current diff.
   ```

   `code-review` applies the `## Review rules` of `dotnet-implementation` and reports 🔴 / 🟡 / 🟢 findings. It never edits.

The same pattern works with `ts`, `py` and `ng`: `<lang>-create-project` or `ng-create-project` to scaffold, `implementation` to build, `code-review` to check.

---

## Workflow 2: Work a GitHub issue end to end

```bash
apm install development-workflow@apm-hub   # pulls in github, shared and the language packages
```

1. **Plan a large issue into sub-issues** (optional)

   ```text
   Plan issue #42.
   ```

   `issue-planning` explores the codebase, splits the work into scoped tasks and creates native GitHub sub-issues.

2. **Run the orchestrated pipeline**

   ```text
   /orch feature 42
   ```

   `orch-pipeline` creates the branch per the conventional-commit type, writes up to five testable tasks and stops at **gate 1** for approval. Each task then goes through red → green → refactor and `verify-project`. `review-fanout` reviews the diff in parallel dimensions; blocking findings are fixed and re-reviewed. **Gate 2** shows the verdict and `git diff --stat` before committing.

   Modes: `feature` (default), `fix` (first task is a failing reproduction test), `review` (only run the review fan-out).

3. **Open the pull request**

   ```text
   Create a PR for this branch.
   ```

   `github-pull-request` generates a conventional title and a structured body from the commits and the linked issue, then creates it with `gh`.

Without the pipeline, `github-issue` alone implements a single issue or a batch: it reads the labels (`epic`, `feature`, `pbi`, `task`, `bug`), checks for sub-issues and follows the matching reference workflow.

---

## Workflow 3: Verify a change

```text
Verify the project.
```

`verify-project` loads `detect-techstack`, runs the build with the detected package manager, runs the tests through each detected `<lang>-test` skill and lints. It returns a JSON result with `ok` or `fail` and the first error line, which is also what `orch-pipeline` reads.

---

## Workflow 4: Set up tooling in a TypeScript or Angular project

```bash
apm install ts@apm-hub
apm install ng@apm-hub   # Angular only
```

| Goal | Prompt | Skill |
| :-- | :-- | :-- |
| Migrate from npm to pnpm | "Switch this project to pnpm." | `ts-pnpm-workflow` |
| ESLint, Prettier and Husky pre-commit | "Set up linting and formatting with pre-commit hooks." | `setup-prettier-eslint-husky` |
| New Angular workspace | "Create an Angular app named shop with Vitest." | `ng-create-project` |
| Standalone component | "Add a product-list component under features/catalog." | `ng-implementation` (`references/component.md`) |
| NgRx Signal Store | "Create a signal store for the cart." | `ng-implementation` (`references/signal-store.md`) |
| AG Grid Enterprise | "Add a grid with row grouping and Excel export." | `ng-ag-grid-developer` |
| MCP server | "Generate an MCP server with a search tool." | `ts-mcp-server-generator` |

---

## Workflow 5: Changelog from conventional commits

```text
Finish the release with an updated changelog.
```

`github-release finish` runs git-cliff for the changelog and, on first use, installs git-cliff, creates `cliff.toml` from its template and adds a `changelog` script (see its `references/cliff-setup.md`). Commit titles produced by `orch-pipeline` and `github-pull-request` already follow the conventional-commit format it expects.

---

## Cross-references

- [Skills](../concepts/skills.md)
- [All skills](../skill-list.md) (generated)
- [Prerequisites](../prerequisites.md)
