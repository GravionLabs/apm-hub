#!/usr/bin/env bash
# SubagentStop hook: append one line per finished subagent to the issue ledger
# (<state>/<issue>/progress.md written by the orchestrator agent). <state> is DROMOS_STATE_DIR, else
# <git common dir>/agents (shared by all worktrees of a repository); neither: no write. Claude Code and Copilot CLI payloads.
# Writes only for the orchestrator's subagents. Target: AGENTS_LEDGER; else the PBI of a live loop marker
# of the payload's checkout, <state>/current.d/<key> (<key> = first 16 hex of the SHA-256 of the git top level of `cwd`, the lease key
# of Enter-Checkout.ps1; content `<pbi> loop-<nr>`, regular file, its loop ledger present without a final `Loop: stopped`, the PBI
# ledger present, the branch number absent, equal to <pbi> or to the marker's recorded branch, or recorded as
# `Loop: PBI #<nr> done`). No marker for that key: when `cwd` lies in no live leased checkout, the one marker whose PBI holds a live
# lease (<state>/leases/*.json, heartbeat within 120 min) is used; when `cwd` lies in a leased checkout, the one marker of that lease's issue
# (the SubagentStop `cwd` after a subagent's `cd` into a worktree is not verified, #466); several candidates: none. The old
# single marker <state>/current is read only while <state>/current.d/ does not exist (legacy, see CONTRIBUTING.md). Else
# <state>/<nr>/progress.md of the issue number in the git branch (<type>/[<scope>/]<nr>[-<slug>]); no ledger,
# no write. Branch without a number, detached HEAD, no git: newest PBI ledger of <state> (DROMOS_STATE_DIR set), but only while at most
# one live lease exists (with more, the newest ledger may belong to another run: no write); git failing inside a repository: no write.
# SubagentStop fires at every depth (pbi-runner and its children) and again on a SendMessage resume, so the
# stop is deduplicated per agent_id and payload hash (sidecar .ledger-seen next to the ledger, regular file only):
# the same stop fired twice is written once, a resumed agent with a new reply (even the same `GATE review`) again.
# pbi-runner stops are summarised from the status of its JSON reply (needs jq): `GATE <phase>`, `DONE <pr>`,
# `BLOCKED`, `FAILED`.
# Every line gets an ISO-8601 UTC prefix `2026-10-21T15:19:46Z ` (same as Add-LedgerLine.ps1); readers accept lines with and without it.
# DROMOS_URL set: after the ledger write the appended line is also POSTed to $DROMOS_URL/ingest (type progress, source
# apm-hub/subagent-stop, issue = the ledger's issue number, agentId = DROMOS_AGENT_ID, data {line, agent}); curl, 500 ms
# timeout, output and failure ignored; agentId is null when neither DROMOS_AGENT_ID nor the payload's agent_id is usable; only https URLs (http to loopback), no credentials in the URL; the reply excerpt leaves the machine; a deduplicated stop posts nothing; DROMOS_URL unset: no network call.
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

TS_RE='[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z '
untimed() { sed -E "s/^$TS_RE//"; } # a ledger line without its optional timestamp prefix
regular() { [ -f "$1" ] && [ ! -L "$1" ] && [ ! -L "$(dirname "$1")" ]; } # regular file, neither it nor its dir a symlink
LEASE_TTL_MIN=120 # same TTL as Enter-Checkout.ps1 -LeaseTtlMinutes
sha16() { # first 16 hex of the SHA-256 of stdin
  if command -v sha256sum >/dev/null 2>&1; then sha256sum
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256
  elif command -v openssl >/dev/null 2>&1; then openssl dgst -sha256 | sed 's/^.* //'
  fi | cut -c1-16
}
checkout_key() { # checkout_key <dir>: lease key of the checkout (git top level) of <dir>; the dir itself outside a repository
  local top
  top="$(GIT_OPTIONAL_LOCKS=0 git --no-optional-locks -C "$1" -c core.fsmonitor=false -c core.hooksPath=/dev/null rev-parse --show-toplevel 2>/dev/null)" || top=""
  [ -n "$top" ] || top="$1"
  top="${top%/}"
  printf '%s' "$top" | sha16
}
iso_epoch() { # iso_epoch 2026-10-21T15:19:46Z: seconds since 1970 (UTC), fails on any other format
  local re='^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})Z$' y m d era yoe doy doe
  [[ "$1" =~ $re ]] || return 1
  y=$((10#${BASH_REMATCH[1]})); m=$((10#${BASH_REMATCH[2]})); d=$((10#${BASH_REMATCH[3]}))
  [ "$m" -le 2 ] && y=$((y - 1))
  era=$((y / 400)); yoe=$((y - era * 400))
  if [ "$m" -gt 2 ]; then doy=$(((153 * (m - 3) + 2) / 5 + d - 1)); else doy=$(((153 * (m + 9) + 2) / 5 + d - 1)); fi
  doe=$((yoe * 365 + yoe / 4 - yoe / 100 + doy))
  echo $(((era * 146097 + doe - 719468) * 86400 + 10#${BASH_REMATCH[4]} * 3600 + 10#${BASH_REMATCH[5]} * 60 + 10#${BASH_REMATCH[6]}))
}
live_leases() { # one line `<checkout path><TAB><issue>` per live lease of <state>/leases (heartbeat within the TTL)
  local f now hb ep p i
  [ -d "$state/leases" ] && [ ! -L "$state/leases" ] || return 0
  now="$(date +%s 2>/dev/null)"; [ -n "$now" ] || return 0
  for f in "$state"/leases/*.json; do
    regular "$f" || continue
    hb="$(sed -n 's/.*"heartbeat"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$f" 2>/dev/null | head -n 1)"
    ep="$(iso_epoch "$hb")" || continue
    [ $((now - ep)) -lt $((LEASE_TTL_MIN * 60)) ] || continue
    p="$(sed -n 's/.*"path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$f" 2>/dev/null | head -n 1)"
    i="$(sed -n 's/.*"issue"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$f" 2>/dev/null | head -n 1)"
    [ -n "$p" ] && [ -n "$i" ] && printf '%s\t%s\n' "$p" "$i"
  done
  return 0
}
marker_pbi() { # marker_pbi <marker file>: the PBI of a well-formed marker (first field), else fails
  local c="" re=$'^([1-9][0-9]{0,9}) (loop-[1-9][0-9]{0,9})( ([1-9][0-9]{0,9}))?\n?$'
  [ -f "$1" ] && [ ! -L "$1" ] || return 1
  IFS= read -r -d '' c < "$1" 2>/dev/null
  [[ "$c" =~ $re ]] && printf '%s' "${BASH_REMATCH[1]}"
}
marker_file() { # marker_file <cwd>: loop marker of the checkout of <cwd>, else nothing
  local d="$state/current.d" m leases own_issue="" best=0 lp li pbi bound="" count=0 real
  real="$(cd "$1" 2>/dev/null && pwd -P)" || real="$1" # the lease paths are real paths (git resolves symlinks)
  # legacy: the single marker <state>/current counts only while no current.d/ exists
  if [ ! -e "$d" ] && [ ! -L "$d" ]; then printf '%s' "$state/current"; return 0; fi
  [ -d "$d" ] && [ ! -L "$d" ] || return 0
  m="$d/$(checkout_key "$1")"
  if [ -f "$m" ] && [ ! -L "$m" ]; then printf '%s' "$m"; return 0; fi
  # no marker for this checkout: resolve it through the lease of the bound PBI. cwd inside a leased checkout: the marker of that
  # lease's issue; cwd in no leased checkout (e.g. the session directory): the marker whose PBI holds a live lease. Exactly one, else none.
  leases="$(live_leases)"
  while IFS=$'\t' read -r lp li; do
    [ -n "$lp" ] || continue
    case "${real%/}/" in "$lp"/*) [ "${#lp}" -gt "$best" ] && { best="${#lp}"; own_issue="$li"; } ;; esac
  done <<< "$leases"
  for m in "$d"/*; do
    pbi="$(marker_pbi "$m")" || continue
    if [ -n "$own_issue" ]; then [ "$pbi" = "$own_issue" ] || continue
    else printf '%s\n' "$leases" | cut -f2 | grep -qx "$pbi" || continue; fi
    bound="$m"; count=$((count + 1))
  done
  [ "$count" -eq 1 ] && printf '%s' "$bound"
  return 0
}
bound_ledger() { # bound_ledger <branch nr>: ledger of the PBI named by the loop marker of the payload's checkout, else nothing
  local m c="" re pbi loop origin loop_ledger last cr=$'\r'
  m="$(marker_file "$cwd")"
  [ -n "$m" ] && [ -f "$m" ] && [ ! -L "$m" ] || return 0
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
  last="$(grep -aE "^($TS_RE)?Loop: " "$loop_ledger" 2>/dev/null | tail -n 1 | untimed)"
  case "$last" in 'Loop: stopped'*) return 0 ;; esac
  # foreign-branch guard: a branch naming another issue wins unless it is the branch -Bind ran on or the loop
  # finished that issue (its previous PBI); a trailing CR (CRLF ledger) is accepted
  if [ -n "$1" ] && [ "$1" != "$pbi" ] && [ "$1" != "$origin" ]; then
    grep -aEq "^($TS_RE)?Loop: PBI #$1 done( |$cr?\$)" "$loop_ledger" 2>/dev/null || return 0
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
      # 4. no number, detached HEAD ("HEAD"), no git or no repository: newest <state>/<issue>/progress.md, loop-<nr> ledgers excluded
      # (loop-x is a PBI ledger); with more than one live lease the newest ledger may be a foreign run's: no write (#466)
      if [ "$(live_leases | grep -c .)" -le 1 ]; then
        ledger="$(ls -t "$state"/*/progress.md 2>/dev/null | grep -v '/loop-[1-9][0-9]*/progress\.md$' | head -n 1)"
      fi
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
  [ "$(tail -n 1 "$ledger" 2>/dev/null | untimed)" = "$line" ] && exit 0
fi
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)" # no date command: the line is written without the (optional) prefix
case "$ts" in [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z) line="$ts $line" ;; esac
printf '%s\n' "$line" >> "$ledger" 2>/dev/null || true
[ -n "$key" ] && { printf '%s\n' "$key" >> "$seen" 2>/dev/null || true; }

# optional: forward the appended line to DROMOS_URL/ingest (after the ledger write, failures never matter). The line carries the
# first 120 characters of the subagent's reply: with DROMOS_URL set that text leaves the machine. Only https URLs (http to localhost, 127.0.0.1, [::1]) without credentials are used.
ingest_url_ok() { # https anywhere, http only to a loopback host; no credentials (user:pass@), no whitespace
  local u="${DROMOS_URL:-}" rest auth host
  [[ "$u" =~ ^https?://[^[:space:]]+$ ]] || return 1
  rest="${u#*://}"; auth="${rest%%[/?#]*}"
  case "$auth" in ''|*@*) return 1 ;; esac
  case "$u" in https://*) return 0 ;; esac
  host="${auth%:*}"; case "$auth" in '['*']'*) host="${auth%%]*}]" ;; esac
  case "$host" in localhost|127.0.0.1|'[::1]') return 0 ;; esac
  return 1
}
if ingest_url_ok && command -v curl >/dev/null 2>&1; then
  jstr() { printf '%s' "$1" | tr -d '\n' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e "s/$(printf '\t')/\\\\t/g"; } # JSON string body
  issue_nr="$(basename "$(dirname "$ledger")")"
  case "$issue_nr" in ''|*[!0-9]*) issue_nr="null" ;; *) issue_nr="$((10#$issue_nr))" ;; esac
  # DROMOS_AGENT_ID, else the payload's agent_id; neither (or nothing valid left after sanitising): JSON null
  aid="$(printf '%s' "${DROMOS_AGENT_ID:-}" | tr -cd 'A-Za-z0-9:_./-' | cut -c1-128)"
  [ -n "$aid" ] || aid="$agent_id"
  if [ -n "$aid" ]; then aid="\"$(jstr "$aid")\""; else aid="null"; fi
  printf '{"type":"progress","source":"apm-hub/subagent-stop","issue":%s,"agentId":%s,"data":{"line":"%s","agent":"%s"}}' \
    "$issue_nr" "$aid" "$(jstr "$line")" "$(jstr "$agent")" \
    | curl -s -S -o /dev/null --max-time 0.5 -X POST -H 'Content-Type: application/json' --data-binary @- "${DROMOS_URL%/}/ingest" >/dev/null 2>&1 || true
fi
exit 0
