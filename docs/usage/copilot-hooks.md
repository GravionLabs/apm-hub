# Copilot CLI hooks (manual setup)

The `hooks` package installs hooks for **Claude Code only**. apm 0.33.0 integrates every event of every hook manifest into every target, so a camelCase Copilot event in the manifests would land in `~/.claude/settings.json` as a dead or duplicate entry (see #254). The scripts read both payload formats (`tool_name // toolName`, `transcript_path`), so Copilot CLI works once you register them yourself.

## Setup

`apm install` copies the scripts to `.claude/hooks/hooks/` (project) or `~/.claude/hooks/hooks/` (global). Register them in a Copilot hook file, for example `~/.copilot/hooks/apm-hub.json` (global) or `.github/hooks/apm-hub.json` (project). The format below is the one older apm versions wrote to `~/.copilot/hooks/*.json`:

```json
{
  "version": 1,
  "hooks": {
    "subagentStop": [
      { "hooks": [{ "type": "command", "command": "bash ~/.claude/hooks/hooks/subagent-ledger.sh", "timeout": 5 }] }
    ],
    "postToolUse": [
      { "hooks": [{ "type": "command", "command": "bash ~/.claude/hooks/hooks/context-warning.sh", "timeout": 5 }] }
    ],
    "preToolUse": [
      { "hooks": [{ "type": "command", "command": "bash ~/.claude/hooks/hooks/git-guardrails.sh", "timeout": 5 }] }
    ]
  }
}
```

For a project install use the absolute path of `.claude/hooks/hooks/` instead. `postToolUse` has no `transcriptPath`; the context warning reads `session-state/<id>/events.jsonl` instead.

Verify the guardrail: in a repository with uncommitted changes ask Copilot CLI to run `git reset --hard`; the call must be denied. If it runs, the hook is not loaded.

## Upgrading from an earlier version

- Copilot CLI users lose the guardrail, ledger and context warning on upgrade until they add the file above.
- Earlier versions wrote Copilot events into `~/.claude/settings.json`; apm may not remove them. Delete the stale entries `subagentStop`, `PostToolUse` with matcher `*` and the `PreToolUse` entry with matcher `*` (keep the `Bash` one). Check `~/.claude/settings.json` by hand, or with jq (writes a copy; review it, then replace the original):

```powershell
jq 'del(.hooks.subagentStop)
  | .hooks.PostToolUse |= (map(select(.matcher != "*" or (tostring | contains("context-warning") | not))) // [])
  | .hooks.PreToolUse |= map(select(.matcher != "*" or (tostring | contains("git-guardrails") | not)))
  | if (.hooks.PostToolUse | length) == 0 then del(.hooks.PostToolUse) else . end' ~/.claude/settings.json > settings.cleaned.json
```
