#!/usr/bin/env bash
# SubagentStop hook: append one line per finished subagent to the issue ledger
# (.agents/<issue>/progress.md written by the orchestrator agent). Claude Code and Copilot CLI payloads.
# Only the orchestrator's subagents are written (allowlist). The ledger is the one of the issue number in the git branch
# (<type>/<nr>-<slug>): .agents/<nr>/progress.md, nothing when it is missing; without a number the newest PBI ledger is
# used. Loop ledgers (.agents/loop-<nr>/) are skipped. AGENTS_LEDGER overrides both.
# SubagentStop fires at every depth (pbi-runner and its children) and again on a SendMessage resume, so the
# stop is deduplicated per agent_id and payload hash (sidecar .ledger-seen next to the ledger, regular file only):
# the same stop fired twice is written once, a resumed agent with a new reply (even the same `GATE review`) again.
# pbi-runner stops are summarised from the status of its JSON reply (needs jq): `GATE <phase>`, `DONE <pr>`,
# `BLOCKED`, `FAILED`.
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

first() { # first non-empty value among the given field names
  local k v
  for k in "$@"; do v="$(field "$k")"; [ -n "$v" ] && { printf '%s' "$v"; return; }; done
}
agent="$(first agent_type agentType agentName subagent_type)"
# the name ends up in a markdown line: allow only name characters, cap 64
agent="$(printf '%s' "$agent" | tr -cd 'A-Za-z0-9:_./-' | cut -c1-64)"
[ -n "$agent" ] || agent="subagent"
# the orchestrator writes its own ledger entries; its stop events are noise (any case or namespace)
agent_lc="$(printf '%s' "$agent" | tr '[:upper:]' '[:lower:]')"
case "$agent_lc" in orchestrator|*[:/.]orchestrator) exit 0 ;; esac
# only the orchestrator's own subagents are recorded; a namespaced name (<prefix>:<name>, <prefix>/<name>) counts by its last part
base="${agent_lc##*[:/]}"
case "$base" in
  issue-reader|explorer|planner|reviewer|review-lead|implementer|pr-writer|pbi-runner) ;;
  *) exit 0 ;;
esac

ledger="${AGENTS_LEDGER:-}"
if [ -z "$ledger" ]; then
  # bind to the issue number of the current branch (<type>/<nr>-<slug>): its ledger or nothing
  branch="$(git -C "$cwd" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if [[ "$branch" =~ ^[a-z]+/([0-9]+)- ]]; then
    ledger="$cwd/.agents/${BASH_REMATCH[1]}/progress.md"
  else
    # no number (or no git): newest .agents/<issue>/progress.md under the working tree, loop-<nr> ledgers excluded (loop-x is a PBI ledger)
    ledger="$(ls -t "$cwd"/.agents/*/progress.md 2>/dev/null | grep -v '/\.agents/loop-[1-9][0-9]*/progress\.md$' | head -n 1)"
  fi
fi
[ -n "$ledger" ] && [ -f "$ledger" ] || exit 0
# never write through a symlink: neither the ledger nor its directory may be one (also for the AGENTS_LEDGER override)
[ ! -L "$ledger" ] && [ ! -L "$(dirname "$ledger")" ] || exit 0

clean() { tr -d '\000-\010\013-\037\177'; } # no control characters in a ledger line
summary="$(first last_assistant_message response | head -n 1 | clean | cut -c1-120)"

last_text_all() { # last assistant text of a JSONL transcript, all lines (needs jq; skips invalid lines)
  [ -n "$1" ] && [ -f "$1" ] && command -v jq >/dev/null 2>&1 || return 0
  jq -rRn '[inputs | fromjson? | objects
    | select(.type == "assistant" or .role == "assistant" or ((.message | objects | .role) == "assistant"))
    | ((.message | objects | .content) // .content)
    | if type == "string" then . elif type == "array" then ([.[] | objects | select(.type == "text") | .text | strings] | join("\n")) else empty end
    | select(length > 0)] | last // empty' "$1" 2>/dev/null
}
last_text_line() { # last non-empty line of that text
  last_text_all "$1" | grep -v '^[[:space:]]*$' | tail -n 1 | clean | cut -c1-120
}
runner_status() { # `GATE <phase>` / `DONE <pr>` / `<STATUS>` from the JSON reply of pbi-runner (needs jq)
  command -v jq >/dev/null 2>&1 || return 0
  local msg
  msg="$(printf '%s' "$payload" | jq -r '.last_assistant_message // .response // empty' 2>/dev/null)"
  [ -n "$msg" ] || msg="$(last_text_all "$(field agent_transcript_path)")"
  # last JSON object of the reply with a known status (a fenced or pretty-printed block, text around it allowed)
  printf '%s' "$msg" | jq -rR -s '
    def valid: type == "object" and (.status | type) == "string" and (.status | test("^(GATE|DONE|BLOCKED|FAILED)$"));
    def cands: . as $s | ([match("\\{"; "g").offset] | .[-20:] | reverse[]) as $i
      | ([$s | match("\\}"; "g").offset] | .[-20:] | reverse[] | select(. > $i)) as $j | $s[$i:$j + 1];
    first(cands | (try fromjson catch empty) | select(valid)) // empty
    | .status + (if .status == "GATE" and ((.phase | type) == "string") and (.phase | test("^[A-Za-z0-9_-]+$")) then " " + .phase
        elif .status == "DONE" and ((.pr | type) == "string") and (.pr | test("^(#?[0-9]+|https://[^ ]+)$")) then " " + .pr else "" end)' 2>/dev/null \
    | head -n 1 | cut -c1-120
}
case "$agent_lc" in pbi-runner|*[:/.]pbi-runner)
  rs="$(runner_status)"
  if [ -n "$rs" ]; then summary="$rs"
  elif ! command -v jq >/dev/null 2>&1; then case "$summary" in '{'*|'```'*) summary="" ;; esac; fi ;;
esac
if [ -z "$summary" ]; then
  # only the subagent's own transcript; transcript_path is the parent session and must not be used
  summary="$(last_text_line "$(field agent_transcript_path)")"
fi
if [ -z "$summary" ] && [ "$agent" = "implementer" ]; then
  # only the implementer writes task reports; accept a report touched in the last 10 minutes
  report="$(find "$(dirname "$ledger")" -maxdepth 1 -name 'task-*-report.md' -mmin -10 -exec ls -t {} + 2>/dev/null | head -n 1)"
  [ -n "$report" ] && summary="report: ${report#"$cwd"/}"
fi

if [ -n "$summary" ]; then
  line="$(printf 'Subagent %s: stopped — %s' "$agent" "$summary")"
else
  line="$(printf 'Subagent %s: stopped' "$agent")"
fi
agent_id="$(field agent_id)"
printf '%s' "$agent_id" | grep -Eq '^[A-Za-z0-9_-]{1,64}$' || agent_id=""
seen="$(dirname "$ledger")/.ledger-seen"
key=""
if [ -n "$agent_id" ] && command -v cksum >/dev/null 2>&1 && [ ! -L "$seen" ] && { [ ! -e "$seen" ] || [ -f "$seen" ]; }; then
  # idempotent per stop event: same agent_id and same payload (a duplicate fire) is written once
  key="$agent_id $(printf '%s' "$payload" | cksum | cut -d' ' -f1)"
  grep -qxF -- "$key" "$seen" 2>/dev/null && exit 0
else
  # no usable agent_id: Copilot CLI may fire both event casings; skip when the last line is identical
  [ "$(tail -n 1 "$ledger" 2>/dev/null)" = "$line" ] && exit 0
fi
printf '%s\n' "$line" >> "$ledger" 2>/dev/null || true
[ -n "$key" ] && { printf '%s\n' "$key" >> "$seen" 2>/dev/null || true; }
exit 0
