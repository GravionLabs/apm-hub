# Hooks

This document explains what **Hooks** are in the context of **GitHub Copilot**, how to configure them, and when to use them.

---

## What Are Hooks?

**Hooks** are custom shell commands that execute deterministically at specific points during a Copilot agent's workflow. They give you precise, guaranteed control over agent behavior at key lifecycle events.

Hooks answer the question:

> **"What must always happen at this exact point in the agent's workflow?"**

Use hooks to:
- Programmatically **approve or deny tool executions** (`preToolUse`)
- **Prevent credential leaks** with built-in secret scanning
- Implement **custom validation, audit logging, or compliance** rules
- Run a **formatter or linter** after every file edit
- **Notify** your team when a session completes

---

## Hook Configuration

Hooks are defined in JSON files in your repository:

```text
.github/hooks/*.json
```

### File Format

```json
{
  "version": 1,
  "hooks": {
    "HOOK_TYPE": [
      {
        "type": "command",
        "bash": "path/to/script.sh",
        "powershell": "path/to/script.ps1",
        "cwd": "scripts",
        "env": { "KEY": "value" },
        "timeoutSec": 30
      }
    ]
  }
}
```

### Property Reference

| Property      | Required                | Description                                                        |
| :------------ | :---------------------- | :----------------------------------------------------------------- |
| `type`        | ✅                       | Must be `"command"`                                                |
| `bash`        | ✅ (Unix systems)        | Bash command or path to script                                     |
| `powershell`  | ✅ (Windows)             | PowerShell command or path to script                               |
| `cwd`         | —                       | Working directory relative to repository root                      |
| `env`         | —                       | Additional environment variables merged with the existing env      |
| `timeoutSec`  | —                       | Maximum execution time in seconds (default: 30)                    |

---

## Hook Types

### `sessionStart`
Executed when a new agent session begins or when resuming an existing session.

**Use for:** Initialize environments, log session starts for auditing, validate project state, set up temporary resources.

### `sessionEnd`
Executed when the agent session completes or is terminated.

**Use for:** Clean up temporary resources, archive session reports/logs, send notifications about session completion.

### `userPromptSubmitted`
Executed when the user submits a prompt to the agent.

**Use for:** Log user requests for auditing and usage analysis.

### `preToolUse` ⭐
Executed **before** the agent uses any tool (e.g., `bash`, `edit`, `view`).

> **This is the most powerful hook type.** It can **approve or deny** tool executions.

**Use for:**
- Block dangerous commands or sensitive operations
- Enforce security policies and coding standards
- Require approval for high-risk actions
- Log tool usage for compliance

When your script **exits with a non-zero code**, the tool execution is denied and the agent is informed.

### `postToolUse`
Executed **after** a tool completes (whether successful or failed).

**Use for:** Log execution results, track usage statistics, generate audit trails, monitor performance, send failure alerts.

### `agentStop`
Executed when the main agent has finished responding to your prompt.

**Use for:** Post-response cleanup, summaries, or notifications.

### `subagentStop`
Executed when a subagent completes, before returning results to the parent agent.

**Use for:** Validate subagent results, log subagent activity, transform output before handoff.

### `errorOccurred`
Executed when an error occurs during agent execution.

**Use for:** Log errors for debugging, send error notifications, track error patterns, generate reports.

---

## Example Configuration

```json
{
  "version": 1,
  "hooks": {
    "sessionStart": [
      {
        "type": "command",
        "bash": "echo \"Session started: $(date)\" >> logs/session.log",
        "powershell": "Add-Content -Path logs/session.log -Value \"Session started: $(Get-Date)\"",
        "cwd": ".",
        "timeoutSec": 10
      }
    ],
    "preToolUse": [
      {
        "type": "command",
        "bash": "./scripts/security-check.sh",
        "powershell": "./scripts/security-check.ps1",
        "cwd": "scripts",
        "timeoutSec": 15
      }
    ],
    "postToolUse": [
      {
        "type": "command",
        "bash": "cat >> logs/tool-results.jsonl",
        "powershell": "$input | Add-Content -Path logs/tool-results.jsonl"
      }
    ],
    "sessionEnd": [
      {
        "type": "command",
        "bash": "./scripts/cleanup.sh",
        "powershell": "./scripts/cleanup.ps1",
        "cwd": "scripts",
        "timeoutSec": 60
      }
    ]
  }
}
```

---

## Performance Considerations

Hooks run **synchronously** and block agent execution. Keep these guidelines in mind:

- **Minimize execution time** — aim for under 5 seconds per hook when possible
- **Use asynchronous logging** — append to files rather than synchronous I/O
- **Background expensive operations** — offload heavy work to background processes
- **Cache results** — avoid recomputing expensive values on every hook call

---

## Security Considerations

- **Always validate and sanitize input** processed by hooks — untrusted input can lead to unexpected behavior
- **Use proper shell escaping** when constructing commands — prevents command injection
- **Never log sensitive data** (tokens, passwords, secrets)
- **Set appropriate permissions** on hook scripts and log files
- **Be cautious with external network calls** — they add latency and may expose data
- **Always set timeouts** — long-running hooks block the agent and degrade performance

---

## IDE and Surface Support

| Surface          | Hooks Supported |
| :--------------- | :-------------- |
| VS Code          | Preview         |
| JetBrains IDEs   | ✗               |
| Copilot CLI      | ✓               |
| GitHub.com       | ✓               |

---

## Related

- [Agents](agents.md) — define custom agent personas
- [Subagents](subagents.md) — the `subagentStop` hook fires when a subagent completes
- [Skills](skills.md) — specialized instructions loaded automatically by Copilot

---

## Further Reading

- [About hooks](https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-hooks) — GitHub Docs: full hooks concept overview
- [Using hooks with GitHub Copilot agents](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/use-hooks) — GitHub Docs: practical guide
- [Hooks configuration reference](https://docs.github.com/en/copilot/reference/hooks-configuration) — GitHub Docs: complete hook type reference with examples
- [Copilot customization cheat sheet](https://docs.github.com/en/copilot/reference/customization-cheat-sheet) — GitHub Docs: comparison of all customization options
