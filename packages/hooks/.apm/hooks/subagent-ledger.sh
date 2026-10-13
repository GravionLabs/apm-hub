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
# the orchestrator writes its own ledger entries; its stop events are noise
[ "$agent" = "orchestrator" ] && exit 0
summary="$(first last_assistant_message response | head -n 1 | cut -c1-120)"

last_text_line() { # last non-empty assistant text line of a JSONL transcript (needs jq)
  [ -n "$1" ] && [ -f "$1" ] && command -v jq >/dev/null 2>&1 || return 0
  jq -rs '[.[] | select(.type == "assistant" or .role == "assistant" or .message.role == "assistant")
    | (.message.content // .content)
    | if type == "string" then . elif type == "array" then ([.[] | select(.type == "text") | .text] | join("\n")) else empty end
    | select(length > 0)] | last // empty' "$1" 2>/dev/null \
    | grep -v '^[[:space:]]*$' | tail -n 1 | cut -c1-120
}
if [ -z "$summary" ]; then
  for k in agent_transcript_path transcript_path; do
    summary="$(last_text_line "$(field $k)")"
    [ -n "$summary" ] && break
  done
fi
if [ -z "$summary" ]; then
  report="$(ls -t "$(dirname "$ledger")"/task-*-report.md 2>/dev/null | head -n 1)"
  [ -n "$report" ] && summary="report: ${report#"$cwd"/}"
fi

if [ -n "$summary" ]; then
  line="$(printf 'Subagent %s: stopped — %s' "$agent" "$summary")"
else
  line="$(printf 'Subagent %s: stopped' "$agent")"
fi
# idempotent: Copilot CLI may fire both event casings; skip when the last line is identical
[ "$(tail -n 1 "$ledger" 2>/dev/null)" = "$line" ] && exit 0
printf '%s\n' "$line" >> "$ledger" 2>/dev/null || true
exit 0
