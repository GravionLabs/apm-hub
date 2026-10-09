# apm-hub — Project Instructions

apm-hub is a marketplace of agent **skills** distributed as APM packages. Read [AGENTS.md](../AGENTS.md) for the layout, the package/skill table, conventions and commands. Everything below only adds Copilot-specific notes.

## Where things are

- Skills: `packages/<domain>/.apm/skills/<name>/SKILL.md` (+ `scripts/`, `references/`, `templates/`, `assets/`)
- Package manifest: `packages/<domain>/apm.yml` (`skills:` list must match the directories; `node scripts/check-manifests.mjs --fix`)
- Generators and tests: `src/` (TypeScript, Vitest). `pnpm run build; pnpm test`
- Generated docs (`docs/skill-list.md`, `docs/template-list.md`, `docs/instruction-list.md`) are rebuilt by CI on `main`. Do not commit them in a branch.

## Skill frontmatter

```yaml
---
name: my-skill                 # kebab-case, matches the directory
description: >
  What it does. Use this skill when … (specific triggers).
license: MIT                   # optional
metadata: { key: value }       # optional, free-form strings
---
```

No other top-level keys. Body ≤ 100 lines, shell fences ` ```powershell `.

## Code review guidelines

Focus on correctness, contradictions between skills, duplicated rules, and broken references. Do not flag style nits.
