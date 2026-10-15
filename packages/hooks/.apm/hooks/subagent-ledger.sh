#!/usr/bin/env bash
# SubagentStop hook: append one line per finished subagent to the issue ledger
# (.agents/<issue>/progress.md written by the orchestrator agent). Claude Code and Copilot CLI payloads.
# Loop ledgers (.agents/loop-<nr>/) are skipped: the newest PBI ledger is used.
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
  # newest .agents/<issue>/progress.md under the working tree, loop-<nr> ledgers excluded (loop-x is a PBI ledger)
  ledger="$(ls -t "$cwd"/.agents/*/progress.md 2>/dev/null | grep -v '/\.agents/loop-[1-9][0-9]*/progress\.md$' | head -n 1)"
fi
[ -n "$ledger" ] && [ -f "$ledger" ] || exit 0
# never write through a symlink: neither the ledger nor its directory may be one (also for the AGENTS_LEDGER override)
[ ! -L "$ledger" ] && [ ! -L "$(dirname "$ledger")" ] || exit 0

first() { # first non-empty value among the given field names
  local k v
  for k in "$@"; do v="$(field "$k")"; [ -n "$v" ] && { printf '%s' "$v"; return; }; done
}
agent="$(first agent_type agentType agentName subagent_type)"
[ -n "$agent" ] || agent="subagent"
# the orchestrator writes its own ledger entries; its stop events are noise (any case or namespace)
agent_lc="$(printf '%s' "$agent" | tr '[:upper:]' '[:lower:]')"
case "$agent_lc" in orchestrator|*[:/.]orchestrator) exit 0 ;; esac
summary="$(first last_assistant_message response | head -n 1 | cut -c1-120)"

last_text_line() { # last non-empty assistant text line of a JSONL transcript (needs jq; skips invalid lines)
  [ -n "$1" ] && [ -f "$1" ] && command -v jq >/dev/null 2>&1 || return 0
  jq -rRn '[inputs | fromjson? | objects
    | select(.type == "assistant" or .role == "assistant" or ((.message | objects | .role) == "assistant"))
    | ((.message | objects | .content) // .content)
    | if type == "string" then . elif type == "array" then ([.[] | objects | select(.type == "text") | .text | strings] | join("\n")) else empty end
    | select(length > 0)] | last // empty' "$1" 2>/dev/null \
    | grep -v '^[[:space:]]*$' | tail -n 1 | cut -c1-120
}
if [ -z "$summary" ]; then
  # only the subagent's own transcript; transcript_path is the parent session and must not be used
  summary="$(last_text_line "$(field agent_transcript_path)")"
fi
if [ -z "$summary" ] && [ "$agent" = "implementer" ]; then
  # only the implementer writes task reports; accept a report touched in the last 10 minutes
  report="$(find "$(dirname "$ledger")" -maxdepth 1 -name 'task-*-report.md' -mmin -10 -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -n 1 | cut -d' ' -f2-)"
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
