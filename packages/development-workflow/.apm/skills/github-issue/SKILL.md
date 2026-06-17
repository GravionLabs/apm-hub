---
name: github-issue
description: >
  Implement a GitHub issue or epic. Routing skill: detects whether the input is
  an epic (issue body contains a checklist of sub-task references) or a
  standalone issue, then strictly follows the appropriate reference document.
---

# github-issue — Issue / Epic Routing Skill

When asked to implement an issue or epic:

1. **Read the issue** to determine if it's an epic or standalone:
   ```bash
   gh issue view <number>
   ```

2. **Follow the correct reference document:**
   - If it is an **Epic** (issue body contains checklist sub-tasks e.g. `- [ ] #<N>`): strictly follow `references/epic-workflow.md`.
   - If it is a **Standalone Issue** (no sub-task checklist): strictly follow `references/standalone-issue.md`.
