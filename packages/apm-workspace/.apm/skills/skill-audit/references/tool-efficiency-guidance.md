## Tool Efficiency Guidance

Use this reference when a skill review, creation, or update includes CLI
examples, scripts, or shell snippets.

### Default rule

- Prefer the smallest useful output.
- Use structured output only when later steps parse, compare, or persist it.
- Avoid wrapping plain text in JSON just to make it look structured.

### Conditional loading examples

If a skill contains CLI examples that are verbose or repetitive, load this
reference before rewriting them.

If a skill adds scripts or command snippets, load this reference before deciding
whether the output should stay text or become JSON.

If a skill only changes prose, do not load this reference.

### Review cues

- `--silent`, `--quiet`, `--nologo`, or equivalent flags should be considered
  when they reduce noise without hiding useful failures.
- Use JSON output when downstream steps need machine-readable data.
- Keep any sample output short and focused on the signal the next step needs.
