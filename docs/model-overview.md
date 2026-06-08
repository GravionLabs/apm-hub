---
description: 'Reference table for all Copilot CLI models: context window, verbosity, instruction-following, token error cost, and recommended use cases'
---

## Model Overview

> **Scope:** All models available via the `model:` frontmatter field in skills and agents,
> and via the `model` parameter of the `task` tool.
>
> **Accuracy note:** Context window sizes for GPT-5.x variants are not all publicly
> confirmed. Values marked with `~` are estimates based on available information.
> Verbosity and instruction-following ratings are qualitative assessments — treat them
> as relative guidance, not absolute benchmarks.
>
> See also: [Sub-task model instructions](concepts/subtask-model-instructions.md)

---

## Reference Table

| Model ID            | Name              | Category     | Context Window |  Verbosity  | Short Instructions | Long Instructions | Token Error Cost | Best For                                                               |
| :------------------ | :---------------- | :----------- | -------------: | :---------: | :----------------: | :---------------: | :--------------: | :--------------------------------------------------------------------- |
| `claude-sonnet-4.6` | Claude Sonnet 4.6 | Standard     |          200 K |    High     |    ✅ Excellent     |    ✅ Excellent    |       High       | Complex multi-step workflows, large codebases, nuanced skill execution |
| `claude-sonnet-4.5` | Claude Sonnet 4.5 | Standard     |          200 K |    High     |    ✅ Excellent     |    ✅ Excellent    |       High       | Same as 4.6; prefer 4.6 when available                                 |
| `claude-sonnet-4`   | Claude Sonnet 4   | Standard     |          200 K | Medium–High |       ✅ Good       |      ✅ Good       |   Medium–High    | General-purpose tasks; slightly less capable than 4.5/4.6              |
| `claude-haiku-4.5`  | Claude Haiku 4.5  | Fast / Cheap |          200 K |     Low     |       ✅ Good       |    ⚠️ Partial     |       Low        | Quick lookups, codebase exploration, simple one-step tasks             |
| `gpt-5.4`           | GPT-5.4           | Standard     |         ~128 K | Medium–High |    ✅ Excellent     |    ✅ Excellent    |       High       | Code review, high-quality reasoning, complex analysis                  |
| `gpt-5.3-codex`     | GPT-5.3-Codex     | Standard     |         ~128 K |   Medium    |       ✅ Good       |      ✅ Good       |   Medium–High    | Code-heavy workflows, generation, and refactoring                      |
| `gpt-5.2-codex`     | GPT-5.2-Codex     | Standard     |         ~128 K |   Medium    |       ✅ Good       |    ⚠️ Partial     |      Medium      | Code generation; step down from 5.3-Codex                              |
| `gpt-5.2`           | GPT-5.2           | Standard     |         ~128 K |   Medium    |       ✅ Good       |      ✅ Good       |      Medium      | Balanced general-purpose; good cost-quality ratio                      |
| `gpt-5.4-mini`      | GPT-5.4 mini      | Fast / Cheap |         ~128 K | Low–Medium  |       ✅ Good       |    ⚠️ Partial     |       Low        | PR creation, changelog writing, simple structured tasks                |
| `gpt-5-mini`        | GPT-5 mini        | Fast / Cheap |          ~64 K |     Low     |       ✅ Good       |    ⚠️ Partial     |     Very Low     | Ultra-fast simple tasks; short context only                            |
| `gpt-4.1`           | GPT-4.1           | Fast / Cheap |          128 K | Low–Medium  |    ✅ Excellent     |      ✅ Good       |       Low        | Mechanical tasks (PRs, commits, formatting); reliable and fast         |

---

## Dimensions Explained

### Context Window

How many tokens fit into the model's input — conversation history, system prompt,
skill bodies, code, and tool results combined.

- **Large (128 K+):** handles long codebases, multiple loaded skills, deep conversation history
- **Small (~64 K):** reach the limit faster; keep skills lean and avoid loading large files

Skills do **not** expand the context window — they consume it. A verbose skill loaded
into a small-context model leaves less room for code, history, and tool results.

### Verbosity

How much output the model produces without an explicit instruction to be concise.

| Rating     | Meaning                                                 |
| :--------- | :------------------------------------------------------ |
| **Low**    | Short, direct answers; minimal explanation              |
| **Medium** | Balanced; explains key decisions without over-narrating |
| **High**   | Detailed explanations, intermediate steps, recaps       |

High verbosity has a compounding effect: every response consumes more context,
leaving less room for subsequent steps. For long-running agentic workflows, prefer
medium or low verbosity models, or add explicit brevity instructions.

### Instruction Following

Whether the model reliably executes the workflow described in a `SKILL.md` body.

- **Short instructions** (≤ 5 numbered steps, no branching): all models handle these well
- **Long instructions** (complex phases, conditional paths, multiple references):
  require a capable model; mini/haiku models may skip steps or conflate phases

Rating key:

| Rating          | Meaning                                                                 |
| :-------------- | :---------------------------------------------------------------------- |
| ✅ **Excellent** | Follows multi-step, conditional, cross-reference instructions precisely |
| ✅ **Good**      | Reliable on most structured skill workflows                             |
| ⚠️ **Partial**  | May skip optional steps, merge phases, or miss conditional loads        |

### Token Error Cost

When a model misinterprets an instruction, takes the wrong branch, or produces an
incorrect intermediate result, how many tokens are consumed before the error surfaces?

| Rating       | Meaning                                                                |
| :----------- | :--------------------------------------------------------------------- |
| **Very Low** | Short outputs → errors surface quickly, recovery is cheap              |
| **Low**      | Fast model + concise output → low total token waste                    |
| **Medium**   | Standard quality; occasional re-runs                                   |
| **High**     | Verbose output + complex reasoning → mistakes produce long wrong paths |

**Practical rule:** high-verbosity standard models are the right choice when
*correctness* matters most. Use fast/cheap models when you can afford a retry
and speed matters more than precision.

---

## Model Selection Guide

Use this decision tree when setting the `model:` field in a skill or sub-task.

```
Is the task complex or multi-step (implementation, refactoring, analysis)?
├─ Yes → claude-sonnet-4.6  (or gpt-5.4 for code-heavy tasks)
└─ No → Is it mechanical (PR, commit message, changelog, formatting)?
         ├─ Yes → gpt-4.1  (fast, reliable, cheap)
         └─ No → Is it a quick lookup or codebase exploration?
                  ├─ Yes → claude-haiku-4.5  (or gpt-5.4-mini)
                  └─ No → Does it involve large code files or long conversations?
                           ├─ Yes → claude-sonnet-4.6  (200 K context)
                           └─ No → gpt-5.2  (balanced cost/quality)
```

### Quick Reference by Task

| Task                                              | Recommended Model                |
| :------------------------------------------------ | :------------------------------- |
| Complex implementation (new feature, refactoring) | `claude-sonnet-4.6`              |
| Code review                                       | `gpt-5.4` or `claude-sonnet-4.6` |
| PR creation, commit messages, changelog           | `gpt-4.1`                        |
| Codebase exploration, file lookup                 | `claude-haiku-4.5`               |
| Code generation (focused)                         | `gpt-5.3-codex`                  |
| Large-context analysis (long files, deep history) | `claude-sonnet-4.6`              |
| Ultra-fast simple sub-tasks                       | `gpt-5-mini`                     |

---

## Model Hints in Skills

Add a `model:` field to a skill's frontmatter to suggest a model at activation time.
The agent may override this if it has a stronger preference.

```yaml
---
name: my-skill
description: >
  Does X when Y.
model: gpt-4.1
---
```

For sub-tasks launched via the `task` tool, pass `model` explicitly:

```markdown
Use the task tool:
- agent_type: code-review
- model: gpt-5.4
- prompt: "..."
```

See [Sub-task model instructions](concepts/subtask-model-instructions.md) for full examples.
