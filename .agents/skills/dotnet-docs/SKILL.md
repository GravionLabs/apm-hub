---
name: dotnet-docs
description: 'Add XML documentation comments to C# public and internal types and members following summary/param/returns/remarks conventions.'
allowed-tools: read write edit editFiles search codebase
compatibility: opencode, github-copilot
---

Add XML documentation comments to C# types and members.

## Rules

### All APIs
- `<summary>`: one sentence, present-tense third-person verb (e.g., "Gets the user by identifier.")
- `<remarks>`: additional context, usage notes, or implementation details
- Do not document the obvious — add value, not noise

See [xml-doc-examples.md](references/xml-doc-examples.md) for templates.

## Steps
1. Identify all public (and internal if requested) types/members missing documentation
2. Add XML comments — prioritize public surface area first
3. Ensure every `<param>` and `<exception>` tag matches actual signature
4. Do not remove existing comments unless incorrect
