#!/usr/bin/env bash
# UserPromptSubmit hook: warn when the session context is large, because every request re-reads it.
# Reads the context size of the last request from the transcript (input + cache read + cache write).
# CONTEXT_WARN_TOKENS (default 150000) is the threshold, CONTEXT_WARN_STEP (default 100000) the growth
# before the next warning. Claude Code only. Never blocks: every path exits 0; no jq, no network.

threshold="${CONTEXT_WARN_TOKENS:-150000}"
step="${CONTEXT_WARN_STEP:-100000}"
payload="$(cat 2>/dev/null || true)"

field() { printf '%s' "$payload" | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -n 1; }

transcript="$(field transcript_path)"
session="$(field session_id)"
[ -n "$transcript" ] && [ -r "$transcript" ] || exit 0
[ -n "$session" ] || session="unknown"

# the last 2 MB hold the newest requests, however long the session is
line="$(tail -c 2000000 "$transcript" 2>/dev/null | grep -a '"cache_read_input_tokens"' | tail -n 1)"
[ -n "$line" ] || exit 0

num() { printf '%s' "$line" | grep -o "\"$1\":[0-9]*" | head -n 1 | grep -o '[0-9]*$'; }
a="$(num input_tokens)"; b="$(num cache_read_input_tokens)"; c="$(num cache_creation_input_tokens)"
ctx=$(( ${a:-0} + ${b:-0} + ${c:-0} )) 2>/dev/null || exit 0

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
