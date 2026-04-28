---
name: common-azuredevops-link-type-resolver
description: "Derives the correct ADO Work Item link type from text descriptions (titles, ACs, descriptions). Use this skill before compiling links into an common-azuredevops-pbi-publisher payload."
model: gpt-4.1
---

# ADO Link Type Resolver

When titles, descriptions, or acceptance criteria of a PBI reference other Work Items, derive the correct link type from the surrounding context.

---

## Detection Rules

### `predecessor` (must be completed before this item)

Phrases indicating **a dependency on an already-completed item** (German or English):

| Phrase examples |
|---|
| “based on #X” / “basierend auf #X” |
| “builds on #X” / “baut auf #X auf” |
| “handler from #X” / “Handler aus #X” |
| “requires #X” / “setzt #X voraus” |
| “needs #X” / “bentötigt #X” |
| “only after #X” / “erst nach #X” |
| “uses result from #X” / “verwendet Ergebnis aus #X” |

---

### `successor` (comes after this item)

Phrases indicating **another item consumes or builds on this one**:

| Phrase examples |
|---|
| “consumed by #X” / “wird konsumiert von #X” |
| “UI in #X uses this” / “UI in #X nutzt das” |
| “control page in #X” / “Steuerungsseite in #X” |
| “#X builds on this” / “#X baut darauf auf” |
| “output used by #X” / “Output wird von #X verwendet” |

---

### `related` (related without ordering)

Phrases indicating a **content relationship without dependency** (German or English):

| Phrase examples |
|---|
| “see Feature #X” / “siehe Feature #X” |
| “complements #X” / “ergänzt #X” |
| “regarding #X” / “in Bezug auf #X” |
| “related Feature #X” / “verwandtes Feature #X” |
| “similar to #X” / “ähnlich wie #X” |
| “part of same context as #X” / “Teil desselben Kontexts wie #X” |

---

## Procedure

1. Scan **title**, **description**, and **acceptance criteria** of each PBI for references to Work Item IDs (`#<number>` or “Feature/PBI/Bug #<number>”)
2. Determine the link type from the surrounding phrase using the detection rules above
3. If no clear match: default to `"related"`

## Output format

For each found link:

```json
{ "linkToId": <ID>, "type": "predecessor|successor|related" }
```

Multiple links per PBI are possible. Empty array `[]` if no references found.
