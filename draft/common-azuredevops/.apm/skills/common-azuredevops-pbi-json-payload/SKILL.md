---
name: common-azuredevops-pbi-json-payload
description: "JSON payload schema for the common-azuredevops-pbi-publisher sub-agent. Use this skill when compiling a payload for creating (create) or updating (update) PBIs or Bugs."
model: gpt-4.1
---

# ADO PBI Publisher – JSON Payload Schema

This skill describes the complete JSON format passed to `common-azuredevops-pbi-publisher`.

---

## Base structure

```json
{
  "project": "Generation and Operations",
  "pbis": [ /* Array of item objects — see below */ ],
  "update_feature_description": {
    "enabled": true,
    "feature_id": 42345,
    "new_description": "HTML or plaintext of the new Feature description"
  }
}
```

- `update_feature_description.enabled: false` → Feature description will not be changed
- The `pbis` array can contain any number of items (create and update mixed)

---

## Item type: Create PBI (`mode: "create"`)

```json
{
  "mode": "create",
  "title": "PBI title",
  "user_story": "As X I want Y so that Z.",
  "description": "Functional description (plaintext).",
  "acceptance_criteria": [
    "Criterion 1 — concrete and testable",
    "Criterion 2",
    "Criterion 3"
  ],
  "implementation_suggestion": "Optional technical notes (leave empty if none).",
  "area_path": "Generation and Operations\\Generation",
  "iteration_path": "Generation and Operations\\Sprint 10",
  "target_feature_id": 42345,
  "links": [
    { "linkToId": 42000, "type": "predecessor" }
  ]
}
```

**Required fields:** `mode`, `title`, `user_story`, `area_path`, `iteration_path`, `target_feature_id`
**Optional:** `description`, `acceptance_criteria`, `implementation_suggestion`, `links`

---

## Item type: Update PBI (`mode: "update"`)

```json
{
  "mode": "update",
  "id": 40686,
  "title": "Updated title",
  "user_story": "As X I want Y so that Z.",
  "description": "Updated functional description (plaintext).",
  "acceptance_criteria": [
    "Criterion 1",
    "Criterion 2",
    "Criterion 3"
  ],
  "implementation_suggestion": "Technical notes or empty.",
  "links": []
}
```

**Required fields:** `mode`, `id`
**Optional:** all other fields (only provided fields will be updated)

---

## Item type: Update Bug (`mode: "update"`, `work_item_type: "Bug"`)

```json
{
  "mode": "update",
  "work_item_type": "Bug",
  "id": 41312,
  "title": "Updated bug title",
  "repro_steps": "Context, actual behavior and expected behavior (plaintext).",
  "acceptance_criteria": [
    "Criterion 1 — bug is considered fixed when ...",
    "Criterion 2",
    "Criterion 3"
  ],
  "implementation_suggestion": "Technical notes on the cause/fix or empty.",
  "links": []
}
```

**Important:** For Bugs use `repro_steps` instead of `description`.

---

## Link types

| `type` value | Meaning |
|-------------|----------|
| `"predecessor"` | This item depends on another (must be done first) |
| `"successor"` | This item comes after another |
| `"related"` | Content relationship without ordering |
| `"parent"` | Hierarchy parent (PBI under Feature) |

---

## Full example (mixed payload)

```json
{
  "project": "Generation and Operations",
  "pbis": [
    {
      "mode": "create",
      "title": "Connect data source XYZ",
      "user_story": "As a Trader I want to import price data hourly so that I always have up-to-date data.",
      "description": "Implementation of the automated import from data source XYZ.",
      "acceptance_criteria": [
        "Data is imported automatically every hour",
        "A notification is triggered on error",
        "Import log is viewable in the system"
      ],
      "implementation_suggestion": "Use REST API from XYZ, configurable polling interval.",
      "area_path": "Generation and Operations\\Generation",
      "iteration_path": "Generation and Operations\\Sprint 10",
      "target_feature_id": 42345,
      "links": []
    },
    {
      "mode": "update",
      "id": 40686,
      "title": "Import monitoring",
      "user_story": "As an Ops team member I want to monitor the import process so that I can detect errors early.",
      "acceptance_criteria": [
        "Import status is visible in real-time",
        "Errors are reported via email"
      ],
      "implementation_suggestion": "",
      "links": []
    }
  ],
  "update_feature_description": {
    "enabled": false
  }
}
```
