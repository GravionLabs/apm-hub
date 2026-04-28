---
name: refinement-pbi-quality-guidelines
description: "Quality guidelines for Product Backlog Items: INVEST principle, User Story format, AC quality check (functional vs. technical), PBI template. Use this skill whenever PBIs are created, revised, or reviewed."
model: gpt-4.1
---

# PBI Quality Guidelines

## User Story Format

**Mandatory format:** `As a [Persona] I want [Goal/Function] so that [Benefit/Value].`

- **Persona**: Concrete user role, not a generic “user” (e.g. Trader, Operations Manager, IT Administrator, automated process)
- **Goal**: What the persona wants to achieve — action-oriented
- **Benefit**: The measurable value — why is this valuable?

---

## INVEST Principle

Each PBI should meet the following criteria:

| Letter | Meaning | Check question |
|--------|---------|----------------|
| **I** | Independent | Can it be implemented without other PBIs? |
| **N** | Negotiable | Is the solution approach still open? |
| **V** | Valuable | Does it deliver real value to the user? |
| **E** | Estimable | Can the team estimate the effort? |
| **S** | Small | Implementable within one sprint (2 weeks)? |
| **T** | Testable | Are there clear acceptance criteria? |

---

## Separation: Functional vs. Technical (MANDATORY)

**Description and Acceptance Criteria** = purely **functional** (What and Why)
**Implementation Suggestion** = technical (How, frameworks, libraries, API routes)

The dev team ultimately decides on the implementation — the Implementation Suggestion is a proposal, not a requirement.

---

## AC Quality Check (mandatory before every output)

Check **each acceptance criterion** for technical details:

**Forbidden content in ACs:**
- Framework or library names (SignalR, Serilog, EF Core, React, …)
- Specific API routes (`/api/...`, `/hubs/...`)
- Class, table, or field names from the code
- Database schema details
- Deployment/infrastructure details

**If technical details are found in an AC:**
1. Move the details to the **Implementation Suggestion**
2. Reformulate the AC in functional terms

**Bad example:** ~~“Notification is sent via SignalR hub `/hubs/automation`”~~

**Correct:** ✅ “Connected dashboard clients are automatically notified in real-time on every status change, without page reload.”

---

## Additional PBI Guidelines

- **Granularity**: Implementable within one sprint (2 weeks)
- **Language**: Write all PBI content in the `workitem_lang` determined at the start of the session
- **Minimum ACs**: 3 concrete, testable criteria per PBI
- **No duplicates**: Do not create a PBI that is already covered by an existing child work item
- **Default values**: If a PBI introduces a configurable flag/setting/status, always explicitly discuss the default value with the user
- **Multi-Feature distribution**: Actively check whether a PBI truly belongs to the feature currently being refined, or whether it better fits under a related feature (e.g. backend changes for a dashboard feature → service feature)

---

## PBI Template

```markdown
## PBI {N}: {Title}
*(Feature #{target_feature_id} – {target_feature_title})*

As a {Persona} I want {Goal} so that {Benefit}.

**Description:**
{Purely functional context, background, and what needs to be implemented.
No technical implementation details here — those belong in "Implementation Suggestion".}

**Acceptance Criteria:**
- [ ] {Criterion 1 — concrete, testable, functionally worded}
- [ ] {Criterion 2 — concrete, testable, functionally worded}
- [ ] {Criterion 3 — concrete, testable, functionally worded}
- [ ] {Additional criteria as needed}

**Implementation Suggestion:**
{Optional technical implementation notes as a proposal for the dev team:
e.g. frameworks, libraries, API routes, architectural approaches, dependencies.
The dev team ultimately decides — this is a suggestion only.
Omit if no meaningful hints are available.}
```
