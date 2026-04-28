---
name: planning2-task-breakdown
description: "Interactive Planning 2 refinement for ADO work items. Given a PBI/Bug number, conducts a structured interview to resolve technical ambiguities (data sources, triggers, cross-repo dependencies, entity mappings, deployment targets, etc.), adds a structured clarification comment to the ticket, and creates child Task work items ready for the development-dotnet-engineer agent."
model: gpt-4.1
---

## Usage

Extract the work item ID from the user's message and hand off to the `planning2-task-breakdown` agent with all provided context.

Invoke the `planning2-task-breakdown` agent with a prompt containing:
- Work item ID: `<ID from user message>`
- Any extra context the user provided (e.g. hints about the technology, repository, or scope)
