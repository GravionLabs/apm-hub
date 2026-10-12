#!/usr/bin/env bash
# SubagentStop hook: append one line per finished subagent to the issue ledger
# (.agents/<issue>/progress.md written by the orchestrator agent). Claude Code and Copilot CLI payloads.
# Never blocks: every path exits 0. Writes nothing when no ledger exists.

payload="$(cat 2>/dev/null || true)"

field() { # field <name>: first string value of "name" in the payload (jq, else sed)
  local v=""
  if command -v jq >/dev/null 2>&1; then
    v="$(printf '%s' "$payload" | jq -r --arg k "$1" '.[$k] // empty' 2>/dev/null)"
  fi
  if [ -z "$v" ]; then
    v="$(printf '%s' "$payload" | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -n 1)"
  fi
  printf '%s' "$v"
}

cwd="$(field cwd)"
[ -n "$cwd" ] && [ -d "$cwd" ] || cwd="$PWD"

ledger="${AGENTS_LEDGER:-}"
if [ -z "$ledger" ]; then
  # newest .agents/<issue>/progress.md under the working tree
  ledger="$(ls -t "$cwd"/.agents/*/progress.md 2>/dev/null | head -n 1)"
fi
[ -n "$ledger" ] && [ -f "$ledger" ] || exit 0

first() { # first non-empty value among the given field names
  local k v
  for k in "$@"; do v="$(field "$k")"; [ -n "$v" ] && { printf '%s' "$v"; return; }; done
}
agent="$(first agent_type agentType agentName subagent_type)"
[ -n "$agent" ] || agent="subagent"
summary="$(first last_assistant_message response | head -n 1 | cut -c1-120)"

printf 'Subagent %s: stopped — %s\n' "$agent" "${summary:-no message}" >> "$ledger" 2>/dev/null || true
exit 0
