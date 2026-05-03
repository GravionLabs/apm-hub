## Skill Writing Rules

Use this reference when drafting or updating a skill.

### Load it when

- A skill file is being created or edited.
- A skill needs structure, frontmatter, reference, asset, or script guidance.
- A skill includes CLI examples, command output, or output-format decisions.

Do not load it when the change is only unrelated prose outside skill authoring.

### Rules to apply

- Keep `SKILL.md` compact and focused on workflow, not long specs.
- Use `.github/skills/<name>/` for repo-level skill tooling and
  `packages/<domain>/.apm/skills/<name>/` for domain workflows.
- Validate `name` carefully: kebab-case, 1-64 chars, and matching the folder.
- Frontmatter must stay specific and imperative.
- Treat frontmatter `model` as a repo-local convention, not official GitHub
  skill syntax. Use it only when an advisory default helps in this repository,
  and keep it aligned with `docs/model-overview.md`.
- Add `compatibility` only when the skill has real runtime or environment needs.
- Use `references/` for stable specs and long tables.
- Use `assets/` for templates or output examples longer than a short snippet.
- Use `scripts/` only for repeatable, flag-based procedures with `--help`,
  structured stdout, diagnostics on stderr, and non-zero failure codes.
- Keep `allowed-tools` minimal; do not pre-approve shell access unless reviewed
  commands require it.
- Use conditional loads and keep reference chains to one level.
- Write conditional behavior as `If X → do Y; otherwise do Z`.
- Use ` ```powershell ` for shell blocks in skill docs.

### Model guidance

- Prefer a short body-level "Model hint" when users may need to switch models
  manually and the recommendation should be visible in the skill body.
- If frontmatter `model` is used, do not imply that it is officially required
  by GitHub skill docs.
- Keep any frontmatter `model` and body-level "Model hint" consistent with each
  other and with `docs/model-overview.md`.
- Avoid vague phrasing like "use a better model"; explain the task shape instead
  (for example, "mechanical task" vs "complex multi-step reasoning").

### Output-efficiency rules

- Prefer the smallest useful CLI output.
- Use JSON only when the next step parses, compares, or persists the data.
- Trim sample output to the signal the workflow needs.
- Avoid wrapping plain text in JSON just because the output should look
  structured.

### Token-efficiency principles

Every token in a skill file is loaded into the model context on every invocation.
Unnecessary tokens increase cost and reduce precision.

**Content placement — what goes where:**

| Content type                           | Location                            |
|----------------------------------------|-------------------------------------|
| Workflow steps the agent follows       | `SKILL.md` body                     |
| Stable specs, error codes, long tables | `references/` (conditional load)    |
| Output templates > ~20 lines           | `assets/` (conditional load)        |
| Repeatable multi-step commands         | `scripts/` (flag-based, not inline) |

**Composition over duplication:**

- If two skills share a workflow, let one delegate to the other — do not copy steps.
- A composite skill body should be a short list of sub-skill invocations, not a clone
  of their content.
- Example: `github-issue-workflow` delegates to `github-issue-start` then
  `github-issue-finish` rather than inlining their phases.

**Conditional loading:**

- Load a reference only when the current task requires it:
  `"If X, read references/Y.md — otherwise skip it."`
- Never auto-load all references at the top of every run.
- Keep reference chains one level deep (A → B, never A → B → C).

**Inline code blocks:**

- Include a code block only when the agent will copy it verbatim in the next step.
- Fallback commands (e.g. CLI alternative to MCP) belong inline only if they are
  short (≤ 5 lines); move longer fallbacks to `references/`.
- Do not list both primary and fallback in the body when the fallback is rarely
  needed — document the primary path and add the fallback as a Gotcha or reference.

**Anti-patterns and their token cost:**

| Anti-pattern                                  | Effect                                           |
|-----------------------------------------------|--------------------------------------------------|
| Duplicate content across skills               | Double the tokens for the same info              |
| Reference file auto-loaded on every run       | Tokens spent even when irrelevant                |
| Long inline fallback blocks                   | Token cost on every invocation even if MCP works |
| Over-specified allowed-tools                  | May widen permissions unnecessarily              |
| Composite skill that clones sub-skill content | Triples token cost; drifts out of sync           |

### Agent tool-call efficiency

These rules apply when a skill involves tool use, CLI commands, or shell pipelines.
Include them as guidance in skills that direct agents to use tools.

**Two-question test — ask before every tool call:**
1. Can I avoid this call entirely? (information already in context → use it)
2. If I must call: how do I minimize bytes returned? (filter/project/truncate at source)

**Structured query tools — never dump a whole file to read one field:**

| Format            | Primary tool                  | PowerShell alternative                                          |
|-------------------|-------------------------------|-----------------------------------------------------------------|
| JSON              | `jq -c '.field'`              | `ConvertFrom-Json \| Select-Object id, status`                  |
| YAML / TOML / XML | `yq '.key'` (cross-platform)  | `yq` (no native PS equivalent)                                  |
| CSV / TSV         | `Import-Csv \| Select-Object` | same                                                            |
| Text / lines      | —                             | `Get-Content -First N`, `Select-String`, `Measure-Object -Line` |

**Precision search — limit before reading:**
- `ast-grep` (cross-platform) for code patterns; replaces multiple grep+read rounds.
- `rg -l` (files only) or `rg -c` (counts only) before fetching file content.

**Git — summarize before diffing:**
- `git diff --stat` or `--name-only` first; then narrow to specific files.
- Never run `git diff` without a path on a large change.

**Suppress output noise:**
- Quiet flags: `-q` (pip/pytest), `--silent` (npm), `--oneline` (git log).
- Strip ANSI codes: `$Env:NO_COLOR = '1'` (PowerShell) or `NO_COLOR=1` (bash/cmd).
- Batch independent commands: `;` (PowerShell) or `&&` (bash/cmd) — one round-trip instead of N.

**Prefer short PowerShell pipelines over Python for simple transforms:**
- `(Get-Content f | Measure-Object -Line).Lines` vs `python -c "print(len(...))"`
- `Get-Content f | Select-String 'pattern'` vs a Python regex script.
- Reach for Python only when multi-step logic or libraries are needed.

### Copilot CLI Session Management

**Chronicle Optimization:**

Copilot CLI records every session and can summarize them at ~80% context full. Skills that output in phases with clear checkpoints compress better.

Recommended output structure:
```markdown
## Summary
[One-line outcome]

## What Changed
- File paths and changes (bullet list)

## Verify
[Command to verify]

## Next Steps
1. [Actionable step]
```

**Context Management:**

- Ask all required questions upfront; avoid back-and-forth (adds messages)
- Return structured output (lists, tables) not prose
- For large file reads: use `head`, `grep`, or `tail` instead of reading entire files
- Redirect verbose command output to files: `cmd > /tmp/log.txt 2>&1`
- Use phases with checkpoints so long sessions can compress earlier work

See: [`docs/chronicle-optimization.md`](../../chronicle-optimization.md) and [`docs/context-management.md`](../../context-management.md)

### Validation rules

- Directory name matches `name`.
- Any frontmatter `model` is optional, repo-local, and consistent with
  `docs/model-overview.md`.
- Body stays focused and does not repeat what a reference already says.
- References are loaded conditionally, not automatically.
- Output follows Chronicle-optimized structure (Summary → What Changed → Verify → Next Steps)
- Token efficiency: avoid prose, use structured lists and checkpoints
- The final skill should be easy to reuse from `skill-create` and
  `skill-update`.
