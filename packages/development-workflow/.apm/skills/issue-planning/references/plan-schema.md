# plan.json schema

Written to `.agents/<issue>/plan.json` by the planning step, read by the primary agent, `orch-pipeline` and `github-issue`. `plan.md` is the human view of the same data.

```json
{
  "phase": "plan",
  "status": "ok",
  "parent_issue": 179,
  "input_type": "feature",
  "level": "pbi",
  "depth": "standard",
  "items": [
    {
      "id": "p1",
      "title": "feat: add plan schema reference",
      "body": "Parent Feature: #179\n\n## Overview\n...\n\n## Acceptance Criteria\n- [ ] ...",
      "size": "S",
      "model": "sonnet",
      "blocked_by": [],
      "files": ["packages/x/.apm/skills/y/SKILL.md"],
      "skills": ["ts-implementation"],
      "issue": null
    }
  ],
  "questions": [
    {
      "id": "q1",
      "question": "Drop the legacy flag now or keep it one release?",
      "options": ["drop now", "keep one release"],
      "recommended": "keep one release",
      "blocks": ["p2"]
    }
  ],
  "summary": "≤120 chars; names the first unblocked item"
}
```

## Fields

| Field | Rule |
|:--|:--|
| `phase`, `status` | `"plan"`; `ok` or `fail` |
| `parent_issue` | Number of the planned issue, `null` for a description |
| `input_type` | `epic`, `feature`, `pbi`, `bug`, `description` |
| `level` | `feature` (from epic), `pbi` (from feature), `task` (from pbi, bug, description) |
| `depth` | `quick`, `standard`, `deep` (exploration budget only) |
| `items[].id` | Unique plan id (`p1`, `p2`, …) |
| `items[].title` | Conventional per level: `Feature: …`, `feat: …` / `fix: …`, `chore: …` |
| `items[].body` | Issue body; for levels `feature` and `pbi` the first line is `Parent Epic: #N` / `Parent Feature: #N` (the parent number, as in `parent_issue`) followed by the sections of the matching template in `packages/github/.apm/issue-templates/`. For `task`, a short self-contained brief |
| `items[].size` | `S`, `M`, `L` (see `slicing.md`) |
| `items[].model` | `haiku`, `sonnet`, `inherit` |
| `items[].blocked_by` | Plan ids or existing issue numbers (integers); acyclic; `[]` when free |
| `items[].files`, `skills` | Files to touch; `<lang>-implementation` names from detect-techstack |
| `items[].issue` | `null` until publish writes the created issue number back |
| `questions[]` | `id`, `question`, `options` (≥ 2), `recommended` (one of `options`), `blocks` (item ids, may be empty); only decisions the repo cannot answer |

## Validity

- Level `task` creates no GitHub issues: `issue` stays `null` and publish is a no-op.
- Every id in `blocked_by` (string) and `blocks` resolves to an item; integers are existing issues.
- Items blocked by an open question wait until the primary agent has the answer and updates the plan.
- Publish writes created numbers into `items[].issue` and sets `status` accordingly; readers use `issue` as the key to the created issue.
