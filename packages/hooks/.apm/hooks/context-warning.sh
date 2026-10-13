#!/usr/bin/env bash
# UserPromptSubmit hook: warn when the session context is large, because every request re-reads it.
# Reads the context size of the last request from the transcript (input + cache read + cache write).
# CONTEXT_WARN_TOKENS (default 150000) is the threshold, CONTEXT_WARN_STEP (default 100000) the growth
# before the next warning. Claude Code only. Never blocks: every path exits 0; no network.
# The payload is parsed with jq when present, else with a bash JSON string scanner (no required dependency);
# both handle escapes, pretty-printed payloads, spaces after colons and any field order. Token counts are read
# from the last transcript line holding a usage object (one JSON object per line, spaces after colons allowed).
# CONTEXT_WARN_DEBUG=1 prints a one-line note on stderr when payload or transcript cannot be parsed; silent otherwise.

threshold="${CONTEXT_WARN_TOKENS:-150000}"
step="${CONTEXT_WARN_STEP:-100000}"
payload="$(cat 2>/dev/null || true)"

note() { [ -n "${CONTEXT_WARN_DEBUG:-}" ] && printf 'context-warning: %s\n' "$*" >&2; return 0; }

jdecode() { # jdecode <string body>: JD = decoded JSON string (\001 and \002 stand for \\ and \")
  local x="$1"
  x=${x//'\n'/$'\n'}; x=${x//'\t'/$'\t'}; x=${x//'\r'/$'\r'}; x=${x//'\/'/"/"}
  x=${x//$'\002'/'"'}; JD=${x//$'\001'/'\'}
}
jsonscan() { # jsonscan <json>: sets J_transcript, J_session from the first "key": "string" pairs (keys outside strings)
  local rest between str prev="" have=0
  rest=${1//'\\'/$'\001'}; rest=${rest//'\"'/$'\002'}
  while :; do
    between="${rest%%\"*}"
    [ ${#between} -eq ${#rest} ] && break
    rest="${rest:${#between}+1}"
    str="${rest%%\"*}"
    [ ${#str} -eq ${#rest} ] && break
    rest="${rest:${#str}+1}"
    if [ "$have" = 1 ] && [[ "$between" =~ ^[[:space:]]*:[[:space:]]*$ ]]; then
      have=0
      case "$prev" in
        transcript_path) [ -n "$J_transcript" ] || { jdecode "$str"; J_transcript="$JD"; } ;;
        session_id) [ -n "$J_session" ] || { jdecode "$str"; J_session="$JD"; } ;;
      esac
    else
      prev="$str"; have=1
    fi
  done
}

J_transcript=""; J_session=""
if command -v jq >/dev/null 2>&1; then
  transcript="$(printf '%s' "$payload" | jq -r '.transcript_path // empty' 2>/dev/null)"
  session="$(printf '%s' "$payload" | jq -r '.session_id // empty' 2>/dev/null)"
else
  jsonscan "$payload"
  transcript="$J_transcript"; session="$J_session"
fi
[ -n "$transcript" ] || { note "no transcript_path in payload"; exit 0; }
[ -r "$transcript" ] || { note "transcript not readable: $transcript"; exit 0; }
[ -n "$session" ] || session="unknown"

# the last 2 MB hold the newest requests, however long the session is
line="$(tail -c 2000000 "$transcript" 2>/dev/null | grep -a '"cache_read_input_tokens"' | tail -n 1)"
[ -n "$line" ] || { note "no usage line in transcript"; exit 0; }

num() { printf '%s' "$line" | grep -oE "\"$1\"[[:space:]]*:[[:space:]]*[0-9]+" | head -n 1 | grep -o '[0-9]*$'; }
a="$(num input_tokens)"; b="$(num cache_read_input_tokens)"; c="$(num cache_creation_input_tokens)"
ctx=$(( ${a:-0} + ${b:-0} + ${c:-0} )) 2>/dev/null || { note "unreadable token counts"; exit 0; }

state="${TMPDIR:-/tmp}/claude-context-warning-${session//[^A-Za-z0-9_-]/_}"

if [ "$ctx" -lt "$threshold" ]; then
  rm -f "$state" 2>/dev/null
  exit 0
fi

last=0
[ -r "$state" ] && last="$(cat "$state" 2>/dev/null)"
case "$last" in ''|*[!0-9]*) last=0 ;; esac
if [ "$last" -gt 0 ] && [ "$ctx" -lt $(( last + step )) ]; then
  exit 0
fi

printf '%s' "$ctx" > "$state" 2>/dev/null

printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"Context is %sk tokens (limit %sk). Finish the current step, append the hand-off to .agents/<issue>/progress.md, then /clear and resume."}}\n' \
  "$(( ctx / 1000 ))" "$(( threshold / 1000 ))"
exit 0
