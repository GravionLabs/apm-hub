# AGENTS.md

<!-- Replace with a one-paragraph description of what this CI/GitHub Actions repository provides. -->

---

## Repo Map

```
.github/
  workflows/          — Reusable workflows (called via `uses:`)
<tool-a>/
  <action>/           — Composite action for <tool-a> (action.yml)
<tool-b>/
  setup/              — Setup composite action
  build/              — Build composite action
  test/               — Test composite action
versioning/           — Versioning actions (determine-version, create-tag, gh-release)
scripts/              — Helper scripts used by actions
```

---

## Architecture: Reusable Workflows vs. Composite Actions

| | Reusable Workflow (`.github/workflows/*.yml`) | Composite Action (`<path>/action.yml`) |
| :--- | :--- | :--- |
| **Called with** | `uses: org/repo/.github/workflows/file.yml@ref` | `uses: org/repo/path/to/action@ref` |
| **Can have jobs** | ✅ Yes (multiple jobs, parallelism) | ❌ No — steps only |
| **Permissions** | Set in the reusable workflow | Inherited from calling job |
| **Best for** | Full CI/CD pipelines | Reusable step sequences |

---

## Key Conventions

- Action inputs use `kebab-case`
- Boolean inputs: use `'true'` / `'false'` strings (YAML limitation)
- All composite actions have an `action.yml` at their directory root
- Reusable workflows live exclusively in `.github/workflows/`
- Tool-specific input prefixes: `dotnet-version`, `python-version`, `node-version`
- Generic flags: no prefix — `configuration`, `verbosity`, `coverage-format`

---

## Adding a New Action

1. Create a directory: `<tool>/<action>/`
2. Add `action.yml` with `runs.using: composite`
3. If it should be callable as a full pipeline, also add `.github/workflows/<name>.yml` with `on: workflow_call`
4. Surface new inputs in the reusable workflow if they should be user-facing
5. Update `AGENTS.md` Repo Map

---

## Safe Change Checklist

- When adding a new input to a composite action, add it to the corresponding reusable workflow if user-facing
- Test reusable workflows by calling them from a consuming repo's CI
- Do not hardcode repository names or versions — use `inputs` or action version pins
- Use `actions/checkout@v4`, `actions/setup-*@v4+` — keep action versions consistent
