#!/usr/bin/env bash
# SubagentStop hook: append one line per finished subagent to the issue ledger
# (<state>/<issue>/progress.md written by the orchestrator agent). <state> is DROMOS_STATE_DIR, else
# <git common dir>/agents (shared by all worktrees of a repository); neither: no write. Claude Code and Copilot CLI payloads.
# Writes only for the orchestrator's subagents. Target: AGENTS_LEDGER; else the PBI of a live loop marker
# <state>/current (`<pbi> loop-<nr>`, regular file, its loop ledger present without a final `Loop: stopped`, the PBI
# ledger present, the branch number absent, equal to <pbi> or to the marker's recorded branch, or recorded as
# `Loop: PBI #<nr> done`); else
# <state>/<nr>/progress.md of the issue number in the git branch (<type>/[<scope>/]<nr>[-<slug>]); no ledger,
# no write. Branch without a number, detached HEAD, no git: newest PBI ledger of <state> (DROMOS_STATE_DIR set); git failing inside a
# repository: no write.
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
agent_lc="$(printf '%s' "$agent" | tr '[:upper:]' '[:lower:]')"
# only the orchestrator's own subagents are recorded (this also drops the orchestrator, which writes its own entries);
# a namespaced name (<prefix>:<name>, <prefix>/<name>, <prefix>.<name>) counts by its last part: plugin namespaces are
# not known up front, and a foreign agent named like an orchestrator role at worst adds a line to the branch ledger
base="${agent_lc##*[:/.]}"
case "$base" in
  issue-reader|explorer|planner|reviewer|review-lead|implementer|pr-writer|pbi-runner) ;;
  *) exit 0 ;;
esac

# BEGIN state_dir (identical in every hook that defines it; test/repo/state-dir-resolver.test.ts)
state_dir() { # state_dir <cwd>: DROMOS_STATE_DIR, else <git common dir>/agents, else nothing
  local c
  if [ -n "${DROMOS_STATE_DIR:-}" ]; then
    case "$DROMOS_STATE_DIR" in /*) printf '%s' "$DROMOS_STATE_DIR" ;; *) printf '%s/%s' "$1" "$DROMOS_STATE_DIR" ;; esac
    return 0
  fi
  c="$(GIT_OPTIONAL_LOCKS=0 git --no-optional-locks -C "$1" -c core.fsmonitor=false -c core.hooksPath=/dev/null rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" || return 0
  [ -n "$c" ] && printf '%s/agents' "$c"
  return 0
}
# END state_dir

regular() { [ -f "$1" ] && [ ! -L "$1" ] && [ ! -L "$(dirname "$1")" ]; } # regular file, neither it nor its dir a symlink
bound_ledger() { # bound_ledger <branch nr>: ledger of the PBI named by the loop marker <state>/current, else nothing
  local m="$state/current" c="" re pbi loop origin loop_ledger last cr=$'\r'
  [ -f "$m" ] && [ ! -L "$m" ] || return 0
  IFS= read -r -d '' c < "$m" 2>/dev/null
  # strict format: one line `<pbi> loop-<nr>[ <origin>]`, optional trailing newline (ASCII only, so length = bytes);
  # <origin> is the issue number of the branch -Bind ran on
  re=$'^([1-9][0-9]{0,9}) (loop-[1-9][0-9]{0,9})( ([1-9][0-9]{0,9}))?\n?$'
  [[ "$c" =~ $re ]] || return 0
  pbi="${BASH_REMATCH[1]}"; loop="${BASH_REMATCH[2]}"; origin="${BASH_REMATCH[4]}"
  # nothing after a NUL byte: the file size must equal what was read
  [ "$(wc -c < "$m" 2>/dev/null | tr -d ' ')" = "${#c}" ] || return 0
  # stale guard: the loop ledger exists and its last `Loop: ` line is not a `Loop: stopped` line
  loop_ledger="$state/$loop/progress.md"
  regular "$loop_ledger" || return 0
  last="$(grep -a '^Loop: ' "$loop_ledger" 2>/dev/null | tail -n 1)"
  case "$last" in 'Loop: stopped'*) return 0 ;; esac
  # foreign-branch guard: a branch naming another issue wins unless it is the branch -Bind ran on or the loop
  # finished that issue (its previous PBI); a trailing CR (CRLF ledger) is accepted
  if [ -n "$1" ] && [ "$1" != "$pbi" ] && [ "$1" != "$origin" ]; then
    grep -aEq "^Loop: PBI #$1 done( |$cr?\$)" "$loop_ledger" 2>/dev/null || return 0
  fi
  regular "$state/$pbi/progress.md" && printf '%s' "$state/$pbi/progress.md"
}

ledger="${AGENTS_LEDGER:-}"
if [ -z "$ledger" ]; then
  state="$(state_dir "$cwd")"
  [ -n "$state" ] || exit 0
  # a symlinked state directory is never written through
  [ ! -L "$state" ] || exit 0
  # issue number of the current branch (<type>/[<scope>/]<nr>[-<slug>]), read without fsmonitor and repository hooks
  branch=""; git_failed=""
  if command -v git >/dev/null 2>&1; then
    # git present: a failure inside a repository (corrupt, unsafe owner, broken git) means: no branch number
    branch="$(git -C "$cwd" -c core.fsmonitor=false -c core.hooksPath=/dev/null rev-parse --abbrev-ref HEAD 2>/dev/null)" || {
      d="$cwd"
      while [ -n "$d" ] && [ "$d" != "/" ] && [ "$d" != "." ]; do [ -e "$d/.git" ] && { git_failed=1; break; }; d="$(dirname "$d")"; done
      branch=""
    }
  fi
  branch="$(printf '%s' "$branch" | tr '[:upper:]' '[:lower:]')"
  branch_re='^(feat|fix|chore|docs|refactor|test|perf|ci|build|style|revert|hotfix)/([^/]+/)*([0-9]+)(-[^/]*)?$'
  nr=""
  [[ "$branch" =~ $branch_re ]] && nr="${BASH_REMATCH[3]}"
  # git failing inside a repository: no write, not even through the loop marker, never the newest ledger
  [ -z "$git_failed" ] || exit 0
  # 1. the loop marker binds the stop to the PBI the loop is running (lines before its branch exists, #375)
  ledger="$(bound_ledger "$nr")"
  if [ -z "$ledger" ]; then
    if [ -n "$nr" ]; then
      # 3. the branch issue's ledger or nothing
      ledger="$state/$nr/progress.md"
    else
      # 4. no number, detached HEAD ("HEAD"), no git or no repository: newest <state>/<issue>/progress.md, loop-<nr> ledgers excluded (loop-x is a PBI ledger)
      ledger="$(ls -t "$state"/*/progress.md 2>/dev/null | grep -v '/loop-[1-9][0-9]*/progress\.md$' | head -n 1)"
    fi
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
  [ -n "$report" ] && summary="report: ${report#"$(dirname "$(dirname "$ledger")")"/}"
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
