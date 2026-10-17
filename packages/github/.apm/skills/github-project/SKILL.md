---
name: github-project
description: 'Bring a GitHub Project (v2) to the standard (Status In release, Level, five views), sync labels to Level/Status, or create one from the template. Use for "/github-project apply|sync|new".'
disable-model-invocation: true
metadata:
  opencode/autoinvoke: 'false'
---

One reproducible project standard for all GravionLabs repos. Paths are relative to this skill's directory.

## Prerequisite

`gh` with scope `project`: `gh auth refresh -s project`. Owner is a user or an organization.

## Modes

| Invocation | Does |
|:--|:--|
| `apply <project-nr>` | Status gets `In release` before `Done`; field `Level`; the five standard views. |
| `sync <project-nr>` | `apply` plus label sync (Level, `merged` ⇄ `In release`). |
| `new <repo>` | Copy the template project, link it to the repo, run `sync`. |

## apply / sync

```powershell
pwsh scripts/Set-ProjectStandard.ps1 -Owner <login> -Number <n> -DryRun          # apply: show the plan first
pwsh scripts/Set-ProjectStandard.ps1 -Owner <login> -Number <n> -Sync            # sync: also items
pwsh scripts/Set-ProjectStandard.ps1 -Owner <login> -Number <n> -Sync -RemoveDefaultViews
```

Always run `-DryRun` first, show the actions to the user, then run without it. `-Json` prints `{actions, manualSteps}`; `-StateFile <json>` plans offline and never calls `gh`.

- Status: option `In release` (BLUE) goes directly before `Done`; every existing option keeps its id, so item values survive.
- Level: created (Epic, Feature, PBI, Task, Bug) only when missing.
- Sync, open issues only: Level from labels `epic|feature|pbi|task|bug` (first match in that order), fallback title prefix `[Epic]`, `[Feature]`, `[PBI]`, `[Task]`, only where Level is empty. Label `merged` → `In release`; `In release` without `merged` → `Todo`. Closed items are untouched.
- Views are matched by name; missing ones are created, others are never touched (`references/views.md`).
- `-RemoveDefaultViews` deletes `View <n>` and `Probe` views, only when all five standard views exist.
- A second run reports `No changes.`

Finish by telling the user the printed manual UI steps (no API): "Show hierarchy" in Hierarchy, sort Recently closed by Closed descending, enable the workflow "Item closed → Done".

## new

1. Copy the template (`references/project-template.md`): GraphQL `copyProjectV2` with `includeDraftIssues: false`.
2. Link it with `linkProjectV2ToRepository`.
3. Run `sync` on the new project number with `-RemoveDefaultViews`.

## Rules

- Never run the script without `-DryRun` first on a project the user has not seen.
- The label `merged` stays the source of truth; the project mirrors it.
