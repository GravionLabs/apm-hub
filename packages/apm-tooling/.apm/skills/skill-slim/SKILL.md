---
name: skill-slim
description: >
  Reduce the size of skills across a package or repo: measure, classify content as keep, move,
  delete or deduplicate, report findings, and apply approved changes. Use this skill when asked
  to slim, shrink, or trim skills, cut token cost, or audit a whole package of skills — not for
  checking a single skill (use skill-audit).
---

## Prerequisites

- Repo root; run read-only analysis first — **no edits before the user approves the findings**
- Follow `skill-write`'s `references/skill-writing-rules.md` for the target shape

## Instructions

### 1. Measure

```powershell
& "$env:SKILL_DIR/scripts/Get-SkillReport.ps1" -Root (Resolve-Path .)
```

JSON on stdout: sizes, skills over the 100-line limit, `danglingCandidates` (some are false positives, e.g. tool names that share a skill prefix — verify each), `duplicatedLines` across skills.

### 2. Classify

Read each large skill and its references. For every block ask: **could the model write this itself?**

| Bucket | Test | Action |
|---|---|---|
| Keep | Repo convention, tool contract, schema, non-obvious gotcha, script or template | Leave; tighten wording |
| Delete | Generic best practice, tool basics, flag tables, debugger commands | Delete; fold any repo-specific rule into the matching `<lang>-implementation` |
| Move | Specs, long tables, examples > ~20 lines | `references/` or `assets/`, loaded conditionally |
| Deduplicate | Same steps in several skills, repeated boilerplate | One skill owns it; others delegate |

Also flag: contradictions between skills (tools, folders, naming), forbidden frontmatter keys, `bash` fences, links that leave the package.

### 3. Report and wait

Show a findings table (skill, bucket, what, estimated bytes saved), the decisions needed from the user, and a phased plan (deletions → merges → splits → consistency fixes). **Stop for approval.**

### 4. Apply

One commit per phase. After each: `pnpm run build; pnpm test`, `node scripts/check-manifests.mjs --fix`, re-run the report (no new dangling references, no skill over the limit), grep for removed skill names.

## Gotchas

- Deleting a skill leaves references in `AGENTS.md`, `apm.yml` descriptions and generated docs — grep for the name
- Keep a trimmed skill's `description` triggering on the same requests
- Never trim vendored content you cannot verify; condense to the non-obvious facts only
