# Copilot CLI hooks (manual setup)

The `hooks` package installs hooks for **Claude Code only**. apm 0.33.0 integrates every event of every hook manifest into every target, so a camelCase Copilot event in the manifests would land in `~/.claude/settings.json` as a dead or duplicate entry (see #254). The scripts themselves read both payload formats (`tool_name // toolName`, `transcript_path`), so Copilot CLI works once you register them yourself.

After `apm install`, the scripts are copied to `.claude/hooks/hooks/` (project) or `~/.claude/hooks/hooks/` (global). Point a Copilot hook file (for example `.github/hooks/apm-hub.json`) at them:

```json
{
  "version": 1,
  "hooks": {
    "subagentStop": [{ "type": "command", "bash": "bash ./subagent-ledger.sh", "timeoutSec": 5 }],
    "postToolUse": [{ "type": "command", "bash": "bash ./context-warning.sh", "timeoutSec": 5 }],
    "preToolUse": [{ "type": "command", "bash": "bash ./git-guardrails.sh", "timeoutSec": 5 }]
  }
}
```

Adjust the script paths to where the scripts live in your setup. `postToolUse` has no `transcriptPath`; the context warning reads `session-state/<id>/events.jsonl` instead.
