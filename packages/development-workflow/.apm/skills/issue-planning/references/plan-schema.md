# plan.json schema

Written to `.agents/<issue>/plan.json` by the planning step, read by the primary agent and by `orch-pipeline` when it is told to plan larger work. Publishing follows `publish.md`. `plan.md` is the human view of the same data. Machine-checkable form: `plan.schema.json` (structure); graph invariants are listed under Validity.

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
      "blocks": ["p1"]
    }
  ],
  "summary": "≤120 chars; names the first unblocked item"
}
```

## Fields

| Field | Rule |
|:--|:--|
| `phase`, `status` | `"plan"`; planning sets `ok` or `fail`; publish sets `published` or `partial` (the failing step goes in `summary`) |
| `parent_issue` | Number of the planned issue, `null` for a description |
| `input_type` | `epic`, `feature`, `pbi`, `bug`, `description` |
| `level` | `feature` (from epic), `pbi` (from feature), `task` (from pbi, bug, description) |
| `depth` | `quick`, `standard`, `deep` (exploration budget only) |
| `items[].id` | Unique plan id (`p1`, `p2`, …) |
| `items[].title` | Conventional per level: `Feature: …`, `feat: …` / `fix: …`, `chore: …` |
| `items[].body` | Issue body; for levels `feature` and `pbi` the first line is `Parent Epic: #N` / `Parent Feature: #N` (the parent number, as in `parent_issue`) followed by the sections of the matching issue template (see the `github-issue` skill). For `task`, the Task issue body (Parent PBI line, or `Parent Bug: #<bug>` for a Bug parent; Overview, Implementation Notes, agent-ready block with Context, Depends on, Files, Done when) |
| `items[].size` | `S`, `M`, `L` (see `slicing.md`) |
| `items[].model` | `haiku`, `sonnet`, `inherit` |
| `items[].blocked_by` | Plan ids or existing issue numbers (integers); acyclic; `[]` when free |
| `items[].files`, `skills` | Files to touch; `<lang>-implementation` names from detect-techstack |
| `items[].issue` | `null` until publish writes the created issue number back |
| `questions[]` | `id`, `question`, `options` (≥ 2), `recommended` (one of `options`), `blocks` (item ids, may be empty); only decisions the repo cannot answer |

## Validity

- Level `task` from a PBI or bug with ≥ 2 items creates `[Task]` sub-issues (`task-issues.md` in `github-issue`); `issue` caches their numbers and the issues stay the source of truth. A single task or a description creates none: `issue` stays `null`, publish is a no-op. Never a mix of null and numbers after publish (`issue-plan-schema.test.ts` checks both rules). A plan from a `description` never has issue numbers.
- Ids are unique. Every string in `blocked_by` and every id in `blocks` resolves to an item; integers are existing issues (publish links them via the blocked_by endpoint even when the item is new). `blocked_by` has no cycles and no self-reference.
- `recommended` is one of `options`; `options` has at least 2 distinct entries.
- Publish runs only after every `questions[]` entry is answered or dropped.
  - Answered: the primary agent sets `recommended` to the chosen option, edits the items listed in `blocks` (title, body, `blocked_by`, size) to reflect it, then removes the question.
  - Dropped: the question is removed, items unchanged.
- Publish writes created numbers into `items[].issue` after every create; readers use `issue` as the key to the created issue.
