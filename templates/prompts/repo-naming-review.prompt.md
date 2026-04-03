---
mode: agent
description: 'Review all prompt template filenames and plugin skill names in the repository against the naming convention: {domain}-{action}, domain-first, no leading verbs, max 3 tokens.'
tools: ['codebase', 'runCommands']
---

# Repo Naming Review

Review all prompt template filenames and plugin skill names against the repository naming convention.

## Convention

**`{domain}-{action}`** — Domain-first, max 3 tokens, no leading verbs, no prepositions.

### Allowed exceptions (established groups, do not flag)

- `create-*-workflow` group: `create-node-workflow`, `create-nuget-workflow`, `create-python-workflow`, `create-wiki-workflow`
- `create-dotnet-solution`
- `setup-prettier-eslint-husky`
- `create-*` template-only prompts without plugin registration: `create-implementation-plan`, `create-specification`, `create-architectural-decision-record`
- `update-*` template-only prompts: `update-implementation-plan`, `update-markdown-file-index`
- `write-*` prompts: `write-tests`, `write-coding-standards-from-file`
- `review-ci-workflow`

## Step 1 — List all prompt template filenames

Run:
```bash
ls templates/prompts/*.prompt.md | sed 's|templates/prompts/||; s|\.prompt\.md||'
```

## Step 2 — List all skill names from plugin configs

Run:
```bash
grep -h '^\s*- name:' plugins/*/plugin.config.yml | sed 's/.*- name: //'
```

## Step 3 — Analyze for violations

For each name, check:
- Does it start with a verb? (`add-`, `start-`, `implement-`, `finish-`, `make-`, `run-`, `build-`)
- Does it contain prepositions? (`-on-`, `-with-`, `-for-`, `-from-`, `-to-`)
- Is it more than 3 tokens (hyphen-separated parts)?
- Is it in the allowed exceptions list?

## Step 4 — Report

Output a structured report:

### ✅ Compliant names
List all names that follow the convention.

### ⚠️ Violations
| Name | Location | Issue | Suggested Rename |
|------|----------|-------|-----------------|
| ... | templates/prompts/ or plugin | verb-first / preposition / too long | `suggested-name` |

### ℹ️ Allowed exceptions
List names that are in the exception list (not violations).

## Step 5 — Summary

Output a one-line summary:
```
Found {N} violations, {M} compliant names, {K} exceptions.
```
