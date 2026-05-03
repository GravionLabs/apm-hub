## Model Selection for Agents

Agent-focused extract from `docs/model-overview.md`.

### Load this reference when

- The agent's task complexity is unclear
- You need to choose a `model:` value for the agent's frontmatter
- Comparing models for a specific agent role

---

## Quick Reference by Agent Role

| Agent role / task type                              | Recommended model              |
|:----------------------------------------------------|:-------------------------------|
| Complex multi-step agents (implementation, analysis)| `claude-sonnet-4.6`            |
| Code review agents                                  | `gpt-5.4` or `claude-sonnet-4.6` |
| Mechanical agents (PR, commit, changelog)           | `gpt-4.1`                      |
| Read-only exploration / codebase lookup agents      | `claude-haiku-4.5`             |
| Code generation agents (focused, no broad reasoning)| `gpt-5.3-codex`                |
| Large-context agents (long files, deep history)     | `claude-sonnet-4.6` (200 K ctx)|
| Ultra-fast simple lookup sub-agents                 | `gpt-5-mini`                   |

---

## Decision Tree

```
Is the agent's task complex or multi-step (implementation, refactoring, analysis)?
├─ Yes → claude-sonnet-4.6  (or gpt-5.4 for code-heavy tasks)
└─ No → Is it mechanical (PR, commit message, changelog, formatting)?
         ├─ Yes → gpt-4.1  (fast, reliable, cheap)
         └─ No → Is it a quick lookup or codebase exploration?
                  ├─ Yes → claude-haiku-4.5  (or gpt-5.4-mini)
                  └─ No → Does it work with large code files or long conversations?
                           ├─ Yes → claude-sonnet-4.6  (200 K context)
                           └─ No → gpt-5.2  (balanced cost/quality)
```

---

## Model Summary Table

| Model ID            | Category     | Context | Verbosity   | Instruction Following | Token Cost   |
|:--------------------|:-------------|--------:|:-----------:|:---------------------:|:------------:|
| `claude-sonnet-4.6` | Standard     |  200 K  | High        | ✅ Excellent           | High         |
| `claude-sonnet-4.5` | Standard     |  200 K  | High        | ✅ Excellent           | High         |
| `claude-haiku-4.5`  | Fast / Cheap |  200 K  | Low         | ✅ Good (short only)   | Low          |
| `gpt-5.4`           | Standard     | ~128 K  | Medium–High | ✅ Excellent           | High         |
| `gpt-5.3-codex`     | Standard     | ~128 K  | Medium      | ✅ Good                | Medium–High  |
| `gpt-5.2`           | Standard     | ~128 K  | Medium      | ✅ Good                | Medium       |
| `gpt-5.4-mini`      | Fast / Cheap | ~128 K  | Low–Medium  | ⚠️ Partial            | Low          |
| `gpt-5-mini`        | Fast / Cheap |  ~64 K  | Low         | ⚠️ Partial            | Very Low     |
| `gpt-4.1`           | Fast / Cheap |  128 K  | Low–Medium  | ✅ Excellent           | Low          |

> ⚠️ Partial = may skip optional steps or miss conditional branches in complex workflows.

---

## Token-Efficiency Note for Agents

Every model loaded in an agent's frontmatter consumes context on each invocation.
High-verbosity models (`claude-sonnet-4.6`, `gpt-5.4`) produce longer responses — prefer them
when correctness matters. Use fast/cheap models when speed and retry cost matter more.

**Rule:** match the model to the agent's *dominant task*, not its worst case.

---

## Applying in Frontmatter

```yaml
model: claude-sonnet-4.6
```

> `model` is an **officially supported optional field** in both GitHub Copilot and Claude Code.
> GitHub Copilot: "Model to use when this custom agent executes. If unset, inherits the default model."
> Claude Code values: `sonnet`, `opus`, `haiku`, a full model ID (e.g. `claude-sonnet-4.6`), or `inherit`.
