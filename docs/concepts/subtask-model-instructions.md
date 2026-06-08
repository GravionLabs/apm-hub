---
description: 'How to start sub-tasks with a specific model from within a Skill or Agent'
---

## Skills & Agents Can Launch Sub-Tasks with a Custom Model

Skills and Agents are pure Markdown files — they contain no imperative code.
However, in the prompt body you can explicitly instruct the AI to call the `task` tool
with a specific model.

---

## Example in a `skill.md` or `*.agent.md`

```markdown
---
name: review-and-pr
description: Code Review + Create PR
---

Perform the following steps:

1. Start a sub-task for the code review using the task tool:
   - agent_type: code-review
   - model: gpt-5.4
   - prompt: "Analyse all changed files in the current branch..."

2. Wait for the code review result.

3. Start a second sub-task for the PR using the task tool:
   - agent_type: general-purpose
   - model: gpt-5.4-mini
   - prompt: "Create a pull request based on the review findings..."
```

---

## How It Works

| Layer               | Description                                               |
| :------------------ | :-------------------------------------------------------- |
| Skill / Agent (.md) | Describes *what* the AI should do — as a prompt           |
| AI (Copilot CLI)    | Interprets the prompt and calls the `task` tool           |
| `task` tool         | Launches a subagent with the given `agent_type` + `model` |

---

## Available `agent_type` Values

| Value             | Purpose                  | Default Model        |
| :---------------- | :----------------------- | :------------------- |
| `explore`         | Explore the codebase     | Haiku (fast / cheap) |
| `task`            | Run commands             | Haiku                |
| `general-purpose` | Complex multi-step tasks | Sonnet               |
| `code-review`     | Analyse code changes     | Sonnet               |

**Custom agents** (example — `csharp-development` plugin):

- `csharp-development:csharp-expert`
- `csharp-development:nunit-engineer`
- `csharp-development:api-architect`
- `csharp-development:modernization`

---

## Model Override (`model` parameter)

For the full model reference including context windows, verbosity, and instruction-following
ratings, see [Model Overview](../model-overview.md).

| Model ID            | Type         | Recommended for                             |
| :------------------ | :----------- | :------------------------------------------ |
| `claude-sonnet-4.6` | Standard     | Complex multi-step tasks, large codebases   |
| `claude-sonnet-4.5` | Standard     | Same as 4.6; prefer 4.6 when available      |
| `claude-haiku-4.5`  | Fast / Cheap | Quick lookups, simple explore tasks         |
| `gpt-5.4`           | Standard     | Code review, high-quality analysis          |
| `gpt-5.3-codex`     | Standard     | Code-heavy generation and refactoring       |
| `gpt-5.2-codex`     | Standard     | Code-specific tasks                         |
| `gpt-5.2`           | Standard     | Balanced general-purpose tasks              |
| `gpt-5.4-mini`      | Fast / Cheap | PR creation, simple structured tasks        |
| `gpt-5-mini`        | Fast / Cheap | Ultra-fast simple sub-tasks                 |
| `gpt-4.1`           | Fast / Cheap | Mechanical tasks (PRs, commits, formatting) |
| `claude-sonnet-4`   | Standard     | General-purpose; older Sonnet generation    |

---

## Important Note

A Skill or Agent can *suggest* a model, but the AI makes the final decision based on
the prompt. The more clearly and explicitly you specify `agent_type` and `model`,
the more reliably the correct values will be used.

**Example phrasing in a prompt:**

> "Use the task tool with `agent_type='code-review'` and `model='gpt-5.4'`"

---

## Full Agent Example

**File:** `.github/agents/review-and-deploy.agent.md`

```markdown
---
name: Review and Deploy Agent
description: Runs code review and PR creation as separate sub-tasks
tools:
  - run-command
  - file-search
---

You are a deployment assistant. When invoked, perform these steps:

### Step 1: Code Review (sub-task with gpt-5.4)
Use the task tool with the following parameters:
- name: "code-review-task"
- agent_type: "code-review"
- model: "gpt-5.4"
- description: "Reviewing code changes"
- prompt: "Perform a full code review of the current branch.
  Check for bugs, security issues, and best practices."

### Step 2: Create PR (sub-task with gpt-5.4-mini)
After the review completes, start a second sub-task:
- name: "create-pr-task"
- agent_type: "general-purpose"
- model: "gpt-5.4-mini"
- description: "Creating pull request"
- prompt: "Create a pull request using the /pr command.
  Use the code review findings as the PR description."
```

