## Skill Writing Rules

Use this reference when drafting or updating a skill.

### Load it when

- A skill file is being created or edited
- A skill needs structure, frontmatter, reference, asset, or script guidance
- A skill includes CLI examples, command output, or output-format decisions

Do not load it when the change is unrelated to skill authoring.

### Rules

- Keep `SKILL.md` ≤ 100 lines (enforced by `src/generators/skill-size-validator.ts`) and focused on workflow, not long specs
- Placement: `packages/<domain>/.apm/skills/<name>/` for domain workflows; `.github/skills/<name>/` only for repo-level contributor tooling
- `name`: kebab-case, 1-64 chars, matches the folder, no leading, trailing or consecutive hyphens
- Frontmatter carries only `name`, `description`, optional `license`, optional `metadata`. **Forbidden top-level keys:** `allowed-tools`, `model`, `compatibility`, anything else — skills must load unchanged on GitHub Copilot, Claude Code and OpenCode. Custom annotations go under `metadata:`
- `description`: imperative, specific, answers "when should I use this?", ≤ 1,024 chars
- Use `references/` for stable specs and long tables, `assets/` for templates longer than a short snippet, `scripts/` only for repeatable flag-based procedures (`--help`, data on stdout, diagnostics on stderr, non-zero exit on failure; `.ps1` preferred)
- Write conditional behavior as `If X → do Y; otherwise do Z`
- Shell blocks use ` ```powershell `
- Prefer the smallest useful CLI output; use JSON only when the next step parses it

### Token efficiency

Every token in a skill body is loaded on every invocation.

| Content | Location |
|---|---|
| Workflow steps the agent follows | `SKILL.md` body |
| Stable specs, error codes, long tables | `references/` (conditional load) |
| Output templates > ~20 lines | `assets/` (conditional load) |
| Repeatable multi-step commands | `scripts/` |

- Compose, don't duplicate: if two skills share a workflow, one delegates to the other (`orch-pipeline` calls `review-fanout` and `verify-project` instead of inlining them)
- Load references conditionally (`If X, read references/Y.md`); never auto-load all of them; keep chains one level deep
- Include a code block only when the agent will copy it verbatim; keep inline fallbacks ≤ 5 lines, longer ones go in `references/`
- Don't explain what the model already knows; state repo conventions, contracts and non-obvious gotchas

### Validation

- Directory name matches `name`
- No forbidden frontmatter keys
- No content duplicated between body and references
- References are loaded conditionally
