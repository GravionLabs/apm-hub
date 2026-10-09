## Skill Audit Checklist

Apply all checks and report findings by severity: 🔴 critical (invalid, fails validation) · 🟡 important (reduces reliability or triggering) · 🟢 suggestion.

Frontmatter field rules live in `frontmatter-schema.md` (same folder) — check against it; the items below are the audit-specific checks.

### Location

- [ ] In `packages/<domain>/.apm/skills/<name>/` (meta/tooling skills in `packages/apm-tooling/...`) — 🟢 if misplaced
- [ ] If under `.github/skills/`: purpose is repo-level contributor tooling, not a domain workflow — 🟢

### Frontmatter

- [ ] `name` present (🔴), matches directory, kebab-case 1-64 chars, no leading/trailing/consecutive hyphens (🟡 if malformed)
- [ ] `description` present (🔴), 1-1,024 chars, imperative ("Use this skill when…"), says what it does and when, has specific trigger keywords, not so broad it fires for unrelated tasks (🟡)
- [ ] Only `name`, `description`, `license`, `metadata` at top level — 🔴 for `allowed-tools`, `model`, `compatibility` or any other key
- [ ] `metadata` values are free-form strings, no nested platform configuration — 🟢

### Body

- [ ] ≤ 100 lines (repo limit) — 🟡; move specs and long tables to `references/`
- [ ] Reference material is in `references/`, templates > ~20 lines in `assets/`, complex multi-step commands in `scripts/` — 🟡/🟢
- [ ] Shell fences are ` ```powershell ` (not `bash`/`sh`) — 🔴
- [ ] Gotchas section for non-obvious facts; conditional paths written as `If X → Y; otherwise Z` — 🟢
- [ ] No content the agent already knows, no vague advice ("handle errors appropriately"), no equal alternatives without a default — 🟡
- [ ] No duplication of another skill's steps — delegate instead — 🟡
- [ ] Not tied to one concrete task (hardcoded names, URLs, ids) — 🟢

### `scripts/` (if present)

- [ ] `--help` implemented — 🟡; no interactive prompts — 🔴; non-zero exit on error with a helpful message — 🟡
- [ ] Data on stdout, diagnostics on stderr — 🟢; dependencies declared and pinned — 🟢

### `references/` and `assets/` (if present)

- [ ] Each file has a conditional load instruction in `SKILL.md` ("If X, read references/Y.md") — 🟡
- [ ] Paths are relative from the skill root — 🔴 if absolute; no chain deeper than one level — 🟡
- [ ] Assets hold templates/data, not prose — 🟢
