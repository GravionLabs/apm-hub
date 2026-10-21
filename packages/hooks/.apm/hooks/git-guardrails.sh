#!/usr/bin/env bash
# PreToolUse hook: deny destructive git commands before they run. Claude Code (tool_name Bash,
# tool_input.command) and Copilot CLI (toolName, toolArgs) payloads. Everything else passes (exit 0, no output).
# Adapted from mattpocock/skills git-guardrails-claude-code (MIT, https://github.com/mattpocock/skills).
# Opt-out per repo: GIT_GUARDRAILS_OFF=1, or an (empty) file guardrails.off in the state directory (DROMOS_STATE_DIR, else <git common dir>/agents). The state dir is shared by all worktrees: the file disables the guard in every worktree of the repository.
#
# This hook is a guardrail against accidents, NOT a security boundary. It catches the destructive git commands
# an agent writes by mistake; a command built to evade it (or a repo that opts out) gets through.
#
# Design notes
# - Fails open on purpose: an empty, non-JSON or truncated payload (or one without a command) exits 0 with no
#   output, as does a command above 24 KB (payload above 256 KB). A guard that blocks every tool call whenever
#   the host sends something unexpected would be worse than the risk it covers.
# - jq is optional. Without it a small bash JSON string scanner extracts tool name, cwd and command, so the
#   hook also works on hosts that only have bash, cat, tr, grep and git (a jq-less Windows/Git Bash setup).
# - The command is tokenized with shell quoting rules, so ';', '|' or '&' inside quotes or heredoc bodies do not
#   split it. Command and process substitution, bash/sh -c strings, eval, git -c alias.* values and wrappers
#   (env, sudo, timeout, xargs, nice, nohup, stdbuf, flock, su -c, script -c, chronic, unbuffer, ...) are
#   inspected like a plain git call. Heredoc bodies are plain text, except when the consumer is a shell
#   (bash <<EOF, sh <<< "...", cat <<EOF | bash: inspected as commands) or the delimiter is unquoted (command
#   substitutions inside the body are inspected). echo/printf text piped into a shell (echo ... | sh, bash -s)
#   or sourced (source <(echo ...)) is inspected as commands. Redirect targets are not arguments.
# - Nesting deeper than 24 levels (substitutions, bash -c, heredocs) is denied, not inspected.
# - Scanning is linear: LC_ALL=C, a sliding 4 KB window (a substring of a long bash string costs O(length)) and
#   bulk pattern replacement in the JSON scanner. bash still spends ~50 us per word, line or pipe, so the cap is
#   24 KB: its worst shapes (many words, quotes, lines, pipes, '((', heredocs) parse in under 1.5 s, well inside
#   the 5 s hook timeout. A longer command fails open; quoted heredoc bodies (commit messages) are cheap.
# - git runs only in the payload cwd's own repository (status, symbolic-ref, rev-parse; no fsmonitor, no hooks,
#   no optional locks). A target given via git -C <other repo> (also a nested or bare repo or git dir inside the
#   cwd repo, found by a file walk, symlinks resolved), --git-dir, --work-tree, GIT_DIR or after cd is
#   never inspected with git: checkout ./restore . there counts as dirty, and a bare force push reads the
#   branch from the HEAD file. Filters (.gitattributes) of the cwd repo still run, as for any git status.
# - Known limits (documented, not fixed): variable forms (g${x}it, $cmd), ANSI-C escapes that build a word
#   ($'\x67it'), abbreviated long options (--har), unwrapped runners (ssh, watch, find -exec, make), pipes into a
#   shell fed by anything other than echo/printf/heredocs, and the in-repo opt-out file (by design).

export LC_ALL=C
payload="$(cat 2>/dev/null || true)"
[ "${GIT_GUARDRAILS_OFF:-}" = "1" ] && exit 0
[ "${#payload}" -gt 262144 ] && exit 0

J_tool=""; J_cwd=""; J_cmd=""; J_args=""

jdecode() { # jdecode <string body>: JD = the decoded JSON string (\001 and \002 stand for \\ and \")
  local x="$1" hex ch
  x=${x//'\n'/$'\n'}; x=${x//'\t'/$'\t'}; x=${x//'\r'/$'\r'}; x=${x//'\b'/}; x=${x//'\f'/}; x=${x//'\/'/"/"}
  while [[ "$x" == *'\u'* ]]; do # one round per distinct code
    hex=${x#*'\u'}; hex="${hex:0:4}"
    case "$hex" in
      000[aA]) ch=$'\n' ;;
      0009) ch=$'\t' ;;
      005[cC]) ch=$'\001' ;;
      00[2-7][0-9a-fA-F]) printf -v ch "\\x${hex:2:2}" ;;
      *) ch="?" ;;
    esac
    x=${x//"\\u$hex"/"$ch"}
  done
  x=${x//$'\002'/'"'}; JD=${x//$'\001'/'\'}
}
jsonscan() { # jsonscan <json>: first string value of tool_name|toolName, cwd, command, toolArgs (keys outside strings only)
  local rest between str prev="" have=0
  rest=${1//'\\'/$'\001'}; rest=${rest//'\"'/$'\002'} # now no '"' inside a string is escaped: bulk work, no char loop
  while :; do
    between="${rest%%\"*}"
    [ ${#between} -eq ${#rest} ] && break
    rest="${rest:${#between}+1}"
    str="${rest%%\"*}"
    [ ${#str} -eq ${#rest} ] && break # unterminated string: fail open
    rest="${rest:${#str}+1}"
    if [ "$have" = 1 ] && [[ "$between" =~ ^[[:space:]]*:[[:space:]]*$ ]]; then # "key": "value"
      have=0
      case "$prev" in
        tool_name | toolName) [ -n "$J_tool" ] || { jdecode "$str"; J_tool="$JD"; } ;;
        cwd) [ -n "$J_cwd" ] || { jdecode "$str"; J_cwd="$JD"; } ;;
        command) [ -n "$J_cmd" ] || { jdecode "$str"; J_cmd="$JD"; } ;;
        toolArgs) [ -n "$J_args" ] || { jdecode "$str"; J_args="$JD"; } ;;
      esac
    else
      prev="$str"; have=1
    fi
  done
}

if command -v jq >/dev/null 2>&1; then
  jfield() { printf '%s' "$payload" | jq -r "$1 // empty" 2>/dev/null; }
  tool="$(jfield '.tool_name // .toolName')"
  cwd="$(jfield '.cwd')"
  cmd="$(jfield '.tool_input.command')"
  if [ -z "$cmd" ]; then # Copilot: toolArgs is a JSON string (or an object)
    cmd="$(printf '%s' "$payload" | jq -r '.toolArgs | if type=="string" then (try fromjson catch {}) else . end | .command // empty' 2>/dev/null)"
  fi
else
  jsonscan "$payload"
  [ -z "$J_cmd" ] && [ -n "$J_args" ] && jsonscan "$J_args" # Copilot: toolArgs is an encoded JSON string
  tool="$J_tool"; cwd="$J_cwd"; cmd="$J_cmd"
fi
case "$(printf '%s' "$tool" | tr '[:upper:]' '[:lower:]')" in bash | shell | powershell | run_shell_command | '') ;; *) exit 0 ;; esac
[ "${#cmd}" -gt 24576 ] && exit 0
plain="${cmd//[\'\"\\]/}"
case "$plain" in *git*) ;; *) exit 0 ;; esac

[ -n "$cwd" ] && [ -d "$cwd" ] || cwd="$PWD"
hgit() { GIT_OPTIONAL_LOCKS=0 GIT_ATTR_NOSYSTEM=1 git --no-optional-locks -c core.fsmonitor=false -c core.hooksPath=/dev/null "$@"; }
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
top="$(hgit -C "$cwd" rev-parse --show-toplevel 2>/dev/null)"
state="$(state_dir "$cwd")"
[ -n "$state" ] && [ -f "$state/guardrails.off" ] && exit 0

deny() {
  local r
  r="$(printf '%s' "$1" | tr -d '\000-\037')"
  r="${r//\\/\\\\}"; r="${r//\"/\\\"}"
  printf '{"permissionDecision":"deny","permissionDecisionReason":"%s","hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$r" "$r"
  exit 0
}
OPTOUT="set GIT_GUARDRAILS_OFF=1 or create <state dir>/guardrails.off (shared by all worktrees) to allow"
# the pre-state-dir opt-out file is no longer read: keep denying, but say where the file belongs now
if [ -n "$top" ] && [ -f "$top/.agents/guardrails.off" ]; then
  OPTOUT="$OPTOUT (the legacy .agents/guardrails.off is no longer read; move it to ${state:-the state directory}/guardrails.off)"
fi
UNKNOWN="(unknown branch)"
PTOP=""; AWD=""; AFOR=""; NOTE=""

protected() { # protected <branch>: main, release/* or a branch that could not be read
  local r="${1#refs/heads/}"
  case "$r" in main | release/* | "$UNKNOWN") return 0 ;; esac
  return 1
}
isgitdir() { # isgitdir <dir>: a repository of its own (.git entry, or a git dir such as a bare repo: HEAD + objects/refs/commondir/config)
  [ -e "$1/.git" ] && return 0
  [ -e "$1/HEAD" ] && { [ -e "$1/objects" ] || [ -e "$1/refs" ] || [ -e "$1/commondir" ] || [ -e "$1/config" ]; }
}
inrepo() { # inrepo <dir>: inside the cwd repo, with no nested repository (.git, bare repo, git dir) on the way up?
  local d
  [ -n "$top" ] || return 1
  [ -n "$PTOP" ] || PTOP="$(cd -P -- "$top" 2>/dev/null && pwd -P)" || return 1
  d="$(cd -P -- "$1" 2>/dev/null && pwd -P)" || return 1
  while :; do
    [ "$d" = "$PTOP" ] && return 0
    isgitdir "$d" && return 1
    case "$d" in "$PTOP"/*) d="${d%/*}" ;; *) return 1 ;; esac
  done
}
headfile() { # headfile <dir>: current branch of the repo around <dir>, read from its HEAD file without running git
  local d h="" l=""
  d="$(cd -P -- "$1" 2>/dev/null && pwd -P)" || { printf '%s' "$UNKNOWN"; return; }
  while [ -n "$d" ]; do
    if [ -d "$d/.git" ]; then h="$d/.git/HEAD"; break; fi
    if [ -f "$d/.git" ]; then
      read -r l <"$d/.git"; l="${l#gitdir: }"
      case "$l" in /* | [A-Za-z]:[/\\]*) ;; *) l="$d/$l" ;; esac
      h="$l/HEAD"; break
    fi
    if [ -f "$d/HEAD" ] && isgitdir "$d"; then h="$d/HEAD"; break; fi
    d="${d%/*}"
  done
  l=""
  { [ -n "$h" ] && { read -r l <"$h" || [ -n "$l" ]; }; } 2>/dev/null || { printf '%s' "$UNKNOWN"; return; }
  case "$l" in "ref: refs/heads/"*) printf '%s' "${l#ref: refs/heads/}" ;; "ref: "*) printf '%s' "$UNKNOWN" ;; esac
}
dirty() { # unknown state (cd, another repo, missing dir, failing status) counts as dirty
  local o
  NOTE=""
  if [ -n "$moved" ]; then NOTE="; the directory after cd is not inspected"; return 0; fi
  if [ "$foreign" = 1 ] || { [ "$cflag" = 1 ] && ! inrepo "$wd"; }; then
    NOTE="; a repository other than the session's is not inspected"; return 0
  fi
  [ -d "$wd" ] || return 0
  o="$(hgit -C "$wd" status --porcelain --untracked-files=no 2>/dev/null)" || return 0
  [ -n "$o" ]
}
has_short() { # has_short <letter> <args...>: a short-option cluster containing the letter
  local l="$1" a; shift
  for a in "$@"; do case "$a" in --*) ;; -*"$l"*) return 0 ;; esac; done
  return 1
}
has_arg() { local x="$1" a; shift; for a in "$@"; do [ "$a" = "$x" ] && return 0; done; return 1; }

check() { # check <tokens...> of one git invocation (after the word git)
  local wd="${AWD:-$cwd}" foreign="${AFOR:-0}" cflag="${AWD:+1}" sub a d dst cur pf isdel force=0 del=0 skip=0 repo=0 v q=""
  local -a args=() opts=() refs=() specs=() al=()
  [ "${genv:-0}" = 1 ] && foreign=1
  while [ $# -gt 0 ]; do # git global options
    case "$1" in
      -C)
        if [ $# -ge 2 ]; then case "$2" in /*) wd="$2" ;; *) wd="$wd/$2" ;; esac; cflag=1; fi
        shift $(($# >= 2 ? 2 : 1)) ;;
      -c)
        if [ $# -ge 2 ]; then case "$2" in [Aa][Ll][Ii][Aa][Ss].*=*) al+=("$2") ;; esac; fi
        shift $(($# >= 2 ? 2 : 1)) ;;
      --git-dir | --work-tree) foreign=1; shift $(($# >= 2 ? 2 : 1)) ;;
      --git-dir=* | --work-tree=*) foreign=1; shift ;;
      --namespace) shift $(($# >= 2 ? 2 : 1)) ;;
      -*) shift ;;
      *) break ;;
    esac
  done
  [ $# -gt 0 ] || return 0
  sub="$1"; shift
  args=("$@")
  for a in "$@"; do [ "$a" = -- ] && break; opts+=("$a"); done # options end at --
  if [ ${#al[@]} -gt 0 ]; then # git -c alias.<name>=<value>: inspect the expansion
    [ $# -gt 0 ] && printf -v q ' %q' "$@"
    for a in "${al[@]}"; do
      v="${a#*=}"; d="${a%%=*}"; d="${d#*.}"; pf=""
      [ "$(printf %s "$d" | tr '[:upper:]' '[:lower:]')" = "$(printf %s "$sub" | tr '[:upper:]' '[:lower:]')" ] && pf="$q" # bash 3.2 (macOS) has no ${var,,}
      case "$v" in
        !*) analyze "${v#!}$pf" ;;
        *) AWD="$wd" AFOR="$foreign" analyze "git $v$pf" ;;
      esac
    done
  fi
  case "$sub" in
    push)
      for a in "${args[@]}"; do
        if [ $skip = 1 ]; then skip=0; continue; fi
        case "$a" in
          --force | --force-with-lease | --force-with-lease=* | --force-if-includes) force=1 ;;
          --delete) del=1 ;;
          --repo) skip=1; repo=1 ;;
          --push-option | --receive-pack | --exec) skip=1 ;;
          --*) ;;
          -*) case "$a" in *f*) force=1 ;; esac
              case "$a" in *d*) del=1 ;; esac
              case "$a" in *o) skip=1 ;; esac ;;
          *) refs+=("$a") ;;
        esac
      done
      specs=("${refs[@]:1}") # refs[0] is the remote (unless --repo names it)
      [ $repo = 1 ] && specs=("${refs[@]}")
      for a in "${specs[@]}"; do case "$a" in +*) force=1 ;; :*) del=1 ;; esac; done
      [ $force = 1 ] || [ $del = 1 ] || return 0
      if [ "$foreign" = 1 ]; then cur="$UNKNOWN"
      elif [ "$cflag" = 1 ] && ! inrepo "$wd"; then cur="$(headfile "$wd")"
      else cur="$(hgit -C "$wd" symbolic-ref --short HEAD 2>/dev/null)"; fi
      if [ ${#specs[@]} -eq 0 ]; then # pushes the current branch
        [ $force = 1 ] && protected "$cur" && deny "git guardrails: force push of $cur is blocked ($OPTOUT)"
        return 0
      fi
      for a in "${specs[@]}"; do
        pf=$force; isdel=0; d="$a"
        case "$d" in +*) pf=1; d="${d#+}" ;; esac
        dst="$d"
        case "$d" in *:*) dst="${d##*:}"; [ -z "${d%%:*}" ] && isdel=1 ;; esac
        dst="${dst#refs/heads/}"
        case "$dst" in HEAD | @) dst="$cur" ;; esac
        protected "$dst" || continue
        { [ $isdel = 1 ] || [ $del = 1 ]; } && [ "$dst" != "release/next" ] && deny "git guardrails: deleting $dst on the remote is blocked ($OPTOUT)"
        [ $pf = 1 ] && deny "git guardrails: force push to $dst is blocked ($OPTOUT)"
      done ;;
    reset)
      has_arg --hard "${opts[@]}" && deny "git guardrails: git reset --hard discards uncommitted work ($OPTOUT)" ;;
    clean)
      has_short n "${opts[@]}" && return 0
      has_arg --dry-run "${opts[@]}" && return 0
      { has_short f "${opts[@]}" || has_arg --force "${opts[@]}"; } && deny "git guardrails: git clean -f deletes untracked files ($OPTOUT)" ;;
    branch)
      for a in "${opts[@]}"; do
        case "$a" in
          --delete) del=1 ;;
          --force) force=1 ;;
          --*) ;;
          -*D*) del=1; force=1 ;;
          -*) case "$a" in *d*) del=1 ;; esac; case "$a" in *f*) force=1 ;; esac ;;
        esac
      done
      [ $del = 1 ] && [ $force = 1 ] && deny "git guardrails: git branch -D force-deletes a branch ($OPTOUT)" ;;
    checkout | restore)
      local all=0 staged=0 wt=0
      for a in "${args[@]}"; do
        case "$a" in
          --staged | -S) staged=1 ;;
          --worktree | -W) wt=1 ;;
          :/ | :/. | ':(top)' | \*) all=1 ;;
          *) [[ "$a" =~ ^\.\.?(/+\.\.?)*/*$ ]] && all=1 ;; # . ./ .. ../.. ./.
        esac
      done
      [ $all = 1 ] || return 0
      [ "$sub" = restore ] && [ $staged = 1 ] && [ $wt = 0 ] && return 0
      dirty && deny "git guardrails: git $sub . discards uncommitted changes$NOTE ($OPTOUT)" ;;
  esac
  return 0
}

S=""; POS=0; moved=""; PD=0; FT=""; HB=""; HP=0
SP_TOP=$'[ \t\n;|&(){}#<>\'"\\\\$`]'
SP_DQ='["\\$`]'
SP_SUB=$'[()`$#<\'"\\\\]' # ends the plain-text fast path of a substitution
SHELLS=" bash sh zsh dash ksh ash "
WRAPS=" sudo doas env command exec nohup time nice setsid timeout xargs stdbuf chronic unbuffer "

analyze() { # analyze <string> [dq]: inspect it as a shell script (dq: text of an unquoted heredoc body)
  local save="$S" W="" B=-1000000 p="${1//[\'\"\\]/}"
  case "$p" in *git*) ;; *) return ;; esac # no git call can come out of it (same test as for the whole command)
  S="$1"; parse "" 0 "${2:-}"
  S="$save"
}

is_assign() { [[ "$1" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; }

shell_c() { # shell_c <start> <words...>: inspect the argument of -c/--command (su, script); no -c: nothing
  local i=$1 x; shift
  local -a t=("$@")
  while [ "$i" -lt ${#t[@]} ]; do
    x="${t[i]}"
    case "$x" in
      --command=*) analyze "${x#--command=}"; return ;;
      -c | --command | -[!-]*c) [ $((i + 1)) -lt ${#t[@]} ] && analyze "${t[i+1]}"; return ;;
    esac
    i=$((i + 1))
  done
}

handle() { # handle <words...>: one simple command, quotes already removed
  local -a t=("$@")
  local i=0 n=$# w x genv="${genv:-0}"
  while [ "$i" -lt "$n" ]; do
    w="${t[i]}"
    if is_assign "$w"; then
      case "$w" in GIT_DIR=* | GIT_WORK_TREE=*) genv=1 ;; esac
      i=$((i + 1)); continue
    fi
    case "${w##*/}" in
      then | do | else | elif | if | while | until | '!' | time | command | builtin | exec | nohup | setsid | '{' | '}') i=$((i + 1)) ;;
      sudo | doas)
        i=$((i + 1))
        while [ "$i" -lt "$n" ]; do
          case "${t[i]}" in
            -u | -g | -h | -p | -C | -D | -R | -T | -U | -r | -t | --user | --group | --host | --prompt | --chdir) i=$((i + 2)) ;;
            -*) i=$((i + 1)) ;;
            *) break ;;
          esac
        done ;;
      nice | ionice)
        i=$((i + 1))
        while [ "$i" -lt "$n" ]; do
          case "${t[i]}" in -n | -c | -p) i=$((i + 2)) ;; -*) i=$((i + 1)) ;; *) break ;; esac
        done ;;
      stdbuf)
        i=$((i + 1))
        while [ "$i" -lt "$n" ]; do
          case "${t[i]}" in -i | -o | -e) i=$((i + 2)) ;; -*) i=$((i + 1)) ;; *) break ;; esac
        done ;;
      chronic | unbuffer)
        i=$((i + 1))
        while [ "$i" -lt "$n" ]; do case "${t[i]}" in -*) i=$((i + 1)) ;; *) break ;; esac; done ;;
      flock) # flock [options] <lockfile> <command...> | flock [options] <lockfile> -c <string>
        i=$((i + 1)); x=0
        while [ "$i" -lt "$n" ]; do
          case "${t[i]}" in
            -c | --command) [ $((i + 1)) -lt "$n" ] && analyze "${t[i+1]}"; return ;;
            -w | -E | --timeout | --wait | --conflict-exit-code) i=$((i + 2)) ;;
            -*) i=$((i + 1)) ;;
            *) [ "$x" = 1 ] && break; x=1; i=$((i + 1)) ;;
          esac
        done ;;
      su | script) shell_c $((i + 1)) "${t[@]}"; return ;;
      env)
        i=$((i + 1))
        while [ "$i" -lt "$n" ]; do
          x="${t[i]}"
          case "$x" in
            -S | --split-string) [ $((i + 1)) -lt "$n" ] && analyze "${t[i+1]}"; return ;;
            -u | -C | --unset | --chdir) i=$((i + 2)) ;;
            -*) i=$((i + 1)) ;;
            *) if is_assign "$x"; then
                 case "$x" in GIT_DIR=* | GIT_WORK_TREE=*) genv=1 ;; esac
                 i=$((i + 1))
               else break; fi ;;
          esac
        done ;;
      timeout)
        i=$((i + 1))
        while [ "$i" -lt "$n" ]; do
          case "${t[i]}" in -s | -k | --signal | --kill-after) i=$((i + 2)) ;; -*) i=$((i + 1)) ;; *) break ;; esac
        done
        i=$((i + 1)) ;; # the duration
      xargs)
        i=$((i + 1))
        while [ "$i" -lt "$n" ]; do
          case "${t[i]}" in -I | -n | -L | -P | -s | -d | -E | -a | --max-args | --max-procs | --delimiter | --arg-file) i=$((i + 2)) ;; -*) i=$((i + 1)) ;; *) break ;; esac
        done ;;
      bash | sh | zsh | dash | ksh | ash)
        i=$((i + 1))
        while [ "$i" -lt "$n" ]; do
          case "${t[i]}" in
            -o | -O) i=$((i + 2)) ;;
            --) break ;;
            --*) i=$((i + 1)) ;;
            -*c*) i=$((i + 1)); [ "$i" -lt "$n" ] && analyze "${t[i]}"; return ;;
            -* | +*) i=$((i + 1)) ;;
            *) break ;;
          esac
        done
        return ;;
      eval) analyze "${t[*]:i+1}"; return ;;
      cd | pushd | popd) moved=1; return ;;
      git) check "${t[@]:i+1}"; return ;;
      *) return ;;
    esac
  done
}

_flush() {
  if [ "$inw" = 1 ]; then
    if [ "$herestr" = 1 ]; then herestr=0; analyze "$w"; fi
    if [ "$redir" = 1 ]; then redir=0; else toks+=("$w"); fi
    w=""; inw=0
  fi
}
_feedtext() { # FT: the literal text an echo/printf command writes, for a shell that reads it
  local i=1
  FT=""
  case "${toks[0]##*/}" in
    echo) while [ "$i" -lt ${#toks[@]} ]; do case "${toks[i]}" in -n | -e | -E | -ne | -en) i=$((i + 1)) ;; *) break ;; esac; done ;;
    printf) ;;
    *) return ;;
  esac
  FT="${toks[*]:i}"; FT="${FT//\\n/$'\n'}"
}
_shconsumer() { # is the collected command a shell that reads its script from stdin (bash, sh -s, bash -)?
  local x s=0
  for x in "${toks[@]}"; do
    if [ "$s" = 0 ]; then
      is_assign "$x" && continue
      case "$x" in -*) continue ;; esac
      case "$WRAPS" in *" ${x##*/} "*) continue ;; esac
      case "$SHELLS" in *" ${x##*/} "*) s=1; continue ;; esac
      return 1
    fi
    [ "$s" = 2 ] && { s=1; continue; } # argument of -o/-O
    case "$x" in
      -) return 0 ;;
      --*) ;; # incl. --: a word after it is a script file
      -o | -O | +o | +O) s=2 ;;
      -*c*) return 1 ;;
      -*s*) return 0 ;;
      -* | +*) ;;
      *) return 1 ;; # a script file: stdin is data
    esac
  done
  [ "$s" != 0 ]
}
_endseg() { # _endseg [pipe]: finish the simple command; "pipe" when its output feeds the next one
  local x
  _flush
  if [ ${#toks[@]} -eq 0 ]; then
    [ "${1:-}" = pipe ] && { piped=1; pfeed=""; phd=(); }
    redir=0; herestr=0; return
  fi
  if [ "$feed" = 1 ]; then _feedtext; [ -n "$FT" ] && analyze "$FT"; fi
  if [ "$piped" = 1 ] && _shconsumer; then
    [ -n "$pfeed" ] && analyze "$pfeed"
    for x in "${phd[@]}"; do hds[x]=1; done
  fi
  case "${toks[*]}" in *git* | *cd* | *pushd* | *popd*) handle "${toks[@]}" ;; esac # nothing else can matter
  if [ "${1:-}" = pipe ]; then
    _feedtext; pfeed="$FT"; piped=1; phd=()
    for ((x = segh; x < ${#hdd[@]}; x++)); do phd+=("$x"); done
  else
    piped=0; pfeed=""; phd=()
  fi
  segh=${#hdd[@]}; toks=(); redir=0; herestr=0
}
_isshell() { # is the command collected so far a shell or source (a heredoc / here-string / <(...) consumer)?
  local x
  for x in "${toks[@]}"; do
    is_assign "$x" && continue
    case "$x" in -*) continue ;; esac
    case "$WRAPS" in *" ${x##*/} "*) continue ;; esac
    case "$SHELLS source . " in *" ${x##*/} "*) return 0 ;; esac
    return 1
  done
  return 1
}
_arith_end() { # _arith_end <index of the first '(' of '((': sets AE to the index after the matching '))'
  local j=$1 d=0 c m=${#S} W="$W" B="$B" win ch
  while ((j < m)); do
    if ((j - B > 3500 || j < B)); then B=$j; W="${S:j:4200}"; fi
    win="${W:j-B:512}"; ch="${win%%[()]*}"
    if [ -n "$ch" ]; then j=$((j + ${#ch})); continue; fi
    c="${W:j-B:1}"; j=$((j + 1))
    case "$c" in '(') d=$((d + 1)) ;; ')') d=$((d - 1)); [ "$d" -le 0 ] && break ;; esac
  done
  AE=$j
}
_hdbody() { # _hdbody <start> <delimiter> <strip-tabs>: heredoc body into HB, the index after its delimiter line into HP
  local p=$1 d="$2" r="" blk="" line n=${#S} # W and B: the caller's (_parse) window
  if [ "$3" != 1 ]; then
    if ((p >= B && p - B < ${#W})); then # try the window first; a long body needs the rest of S
      r=$'\n'"${W:p-B}"; ((B + ${#W} >= n)) && r+=$'\n'
      HB="${r%%$'\n'"$d"$'\n'*}"
    fi
    if [ -z "$r" ] || [ ${#HB} -eq ${#r} ]; then r=$'\n'"${S:p}"$'\n'; HB="${r%%$'\n'"$d"$'\n'*}"; fi
    if [ ${#HB} -eq ${#r} ]; then HB="${S:p}"; HP=$n; else HP=$((p + ${#HB} + ${#d} + 1)); HB="${HB:1}"; fi
    return
  fi
  HB=""
  while ((p < n)); do # <<-: line by line, from a small block so every step stays cheap
    line="${blk%%$'\n'*}"
    if [ ${#line} -eq ${#blk} ]; then
      if ((p >= B && p - B + 1024 <= ${#W})); then blk="${W:p-B:1024}"; else blk="${S:p:1024}"; fi
      line="${blk%%$'\n'*}"
      if [ ${#line} -eq ${#blk} ]; then line="${S:p}"; line="${line%%$'\n'*}"; blk=""; fi
    fi
    blk="${blk:${#line}+1}"; p=$((p + ${#line} + 1))
    [ "${line#"${line%%[!$'\t']*}"}" = "$d" ] && break
    HB+="$line"$'\n'
  done
  HP=$p
}

_subst() { # at "$(" (index i of the caller): move i to the closing ')' of $(...) or $((...))
  local y x
  if [ "${W:o+1:2}" = "((" ]; then _arith_end $((i + 1)); i=$((AE - 1)); return; fi
  y="${W:o+2:512}"; x="${y%%$SP_SUB*}"
  if [ "${y:${#x}:1}" = ")" ] && [[ "$x" != *git* ]]; then i=$((i + ${#x} + 2)); return; fi # plain text: nothing to inspect
  parse ")" $((i + 2)); i=$((POS - 1))
}
_backq() { # at a backtick (index i of the caller): move i to the closing backtick
  local y x
  y="${W:o+1:512}"; x="${y%%$SP_SUB*}"
  if [ "${y:${#x}:1}" = '`' ] && [[ "$x" != *git* ]]; then i=$((i + ${#x} + 1)); return; fi
  parse '`' $((i + 1)); i=$((POS - 1))
}

parse() { # parse <stop-char> <start> [dq|feed]: depth-capped wrapper around _parse
  PD=$((PD + 1))
  [ "$PD" -gt 24 ] && deny "git guardrails: the command nests deeper than 24 levels and is not inspected ($OPTOUT)"
  _parse "$@"
  PD=$((PD - 1))
}

_parse() { # tokenize S, run handle per simple command, leave the end index in POS
  local stop="$1" i="$2" mode="${3:-}" n=${#S} c nx q="" w="" inw=0 redir=0 herestr=0 j pos k body o win chunk W="$W" B="$B" # window of S: inherited
  local feed=0 piped=0 pfeed="" segh=0
  local -a toks=() hdd=() hdq=() hdt=() hds=() phd=()
  [ "$mode" = dq ] && q='"'
  [ "$mode" = feed ] && feed=1
  while ((i < n)); do
    if ((i - B > 3500 || i < B)); then B=$i; W="${S:i:4200}"; fi
    o=$((i - B)); win="${W:o:512}"
    case "$q" in
      "'") chunk="${win%%\'*}" ;;
      '"') chunk="${win%%$SP_DQ*}" ;;
      A) chunk="${win%%[\'\\]*}" ;;
      *) chunk="${win%%$SP_TOP*}" ;;
    esac
    if [ -n "$chunk" ]; then w+="$chunk"; [ -z "$q" ] && inw=1; i=$((i + ${#chunk})); continue; fi
    c="${W:o:1}"
    case "$q" in
      "'") # chunk is empty, so c is the closing quote
        q=""; i=$((i + 1)); continue ;;
      A) # $'...': backslash escapes the next character
        if [ "$c" = '\' ]; then w+="${W:o+1:1}"; i=$((i + 1)); elif [ "$c" = "'" ]; then q=""; else w+="$c"; fi
        i=$((i + 1)); continue ;;
      '"')
        case "$c" in
          '"') if [ "$mode" = dq ]; then w+="$c"; else q=""; fi ;;
          '\')
            nx="${W:o+1:1}"
            case "$nx" in
              '"' | '\' | '$' | '`') w+="$nx"; i=$((i + 1)) ;;
              $'\n') i=$((i + 1)) ;;
              *) w+="$c" ;;
            esac ;;
          '$') if [ "${W:o+1:1}" = "(" ]; then _subst; w+="X"; else w+="$c"; fi ;;
          '`') _backq; w+="X" ;;
          *) w+="$c" ;;
        esac
        i=$((i + 1)); continue ;;
    esac
    case "$c" in
      "'") q="'"; inw=1 ;;
      '"') q='"'; inw=1 ;;
      '\')
        nx="${W:o+1:1}"
        if [ "$nx" != $'\n' ]; then w+="$nx"; inw=1; fi
        i=$((i + 1)) ;;
      '$')
        inw=1
        if [ "${W:o+1:1}" = "(" ]; then _subst; w+="X"
        elif [ "${W:o+1:1}" = "'" ]; then q=A; i=$((i + 1))
        else w+="$c"; fi ;;
      '`')
        if [ "$stop" = '`' ]; then _endseg; POS=$((i + 1)); return; fi
        inw=1; _backq; w+="X" ;;
      ')')
        _endseg
        if [ "$stop" = ")" ]; then POS=$((i + 1)); return; fi ;;
      ' ' | $'\t') _flush ;;
      $'\n')
        _endseg
        if [ ${#hdd[@]} -gt 0 ]; then # read the bodies of the pending heredocs
          pos=$((i + 1))
          for k in "${!hdd[@]}"; do
            _hdbody "$pos" "${hdd[k]}" "${hdt[k]}"; pos=$HP; body="$HB"
            if [ "${hds[k]}" = 1 ]; then analyze "$body"
            elif [ "${hdq[k]}" = 0 ]; then analyze "$body" dq; fi
          done
          hdd=(); hdq=(); hdt=(); hds=(); phd=(); segh=0
          i=$pos; continue
        fi ;;
      '(')
        if [ "$inw" = 0 ] && [ "${W:o:2}" = "((" ]; then _arith_end "$i"; i=$((AE - 1)); else _endseg; fi ;;
      \|)
        if [ "${W:o+1:1}" = "|" ]; then _endseg; i=$((i + 1))
        else _endseg pipe; [ "${W:o+1:1}" = "&" ] && i=$((i + 1)); fi ;;
      \; | \&) _endseg ;;
      '{' | '}') if [ "$inw" = 0 ]; then _endseg; else w+="$c"; fi ;;
      '#')
        if [ "$inw" = 0 ]; then # comment: skip to the end of the line
          body="${W:o:512}"; chunk="${body%%$'\n'*}"
          if [ ${#chunk} -eq ${#body} ]; then body="${S:i}"; chunk="${body%%$'\n'*}"; fi
          i=$((i + ${#chunk} - 1))
        else w+="$c"; fi ;;
      '<' | '>')
        if [ "${W:o+1:1}" = "(" ]; then # process substitution; <(...) read by a shell or source is a script
          _flush
          if [ "$c" = '<' ] && _isshell; then parse ")" $((i + 2)) feed; else parse ")" $((i + 2)); fi
          i=$((POS - 1)); w+="X"; inw=1
        elif [ "${W:o:3}" = "<<<" ]; then
          _flush; _isshell && herestr=1; redir=1; i=$((i + 2))
        elif [ "${W:o:2}" = "<<" ]; then
          _flush
          j=$((i + 2)); k=0; body=""
          [ "${W:j-B:1}" = "-" ] && { k=1; j=$((j + 1)); }
          while [[ "${W:j-B:1}" == [' '$'\t'] ]]; do j=$((j + 1)); done
          pos=0
          while ((j < n)); do
            case "${W:j-B:1}" in
              '' | ' ' | $'\t' | $'\n' | \; | \| | \& | '(' | ')' | '<' | '>') break ;;
              "'" | '"' | '\') pos=1 ;;
              *) body+="${W:j-B:1}" ;;
            esac
            j=$((j + 1))
          done
          hdd+=("$body"); hdq+=("$pos"); hdt+=("$k")
          if _isshell; then hds+=(1); else hds+=(0); fi
          i=$((j - 1))
        else
          if [ "$inw" = 1 ] && [[ "$w" =~ ^[0-9]+$ ]]; then w=""; inw=0; fi # fd number: 2>file
          _flush; redir=1
          [ "${W:o:2}" = ">>" ] && i=$((i + 1))
        fi ;;
      *) w+="$c"; inw=1 ;;
    esac
    i=$((i + 1))
  done
  _endseg
  POS=$n
}

analyze "$cmd"
exit 0
