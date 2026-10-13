#!/usr/bin/env bash
# PreToolUse hook: deny destructive git commands before they run. Claude Code (tool_name Bash,
# tool_input.command) and Copilot CLI (toolName, toolArgs) payloads. Everything else passes (exit 0, no output).
# Adapted from mattpocock/skills git-guardrails-claude-code (MIT, https://github.com/mattpocock/skills).
# Opt-out per repo: GIT_GUARDRAILS_OFF=1, or an (empty) file .agents/guardrails.off in the working tree.
#
# Design notes
# - Fails open on purpose: an empty, non-JSON or truncated payload (or one without a command) exits 0 with no
#   output. A guard that blocks every tool call whenever the host sends something unexpected would be worse
#   than the risk it covers; this hook is a guardrail against accidents, not a security boundary.
# - jq is optional. Without it a small bash JSON string scanner extracts tool name, cwd and command, so the
#   hook also works on hosts that only have bash, cat, tr, grep and git (a jq-less Windows/Git Bash setup).
# - The command is tokenized with shell quoting rules, so ';', '|' or '&' inside quotes or heredoc bodies do not
#   split it. Command and process substitution, bash/sh -c strings, eval and common wrappers (env, sudo,
#   timeout, xargs, nice, nohup, ...) are inspected like a plain git call. Heredoc bodies are plain text, except
#   when the consumer is a shell (bash <<EOF, sh <<< "...": inspected as commands) or the delimiter is unquoted
#   (command substitutions inside the body are inspected). Redirect targets are not arguments.
# - Limits (documented decisions, not bugs): commands above 64 KB (payload above 256 KB) are not scanned and
#   fail open, as does nesting deeper than 24 levels. Not detected: abbreviated long options (--har), unwrapped
#   runners (ssh, watch, find -exec), variable forms (g${x}it, $cmd), ANSI-C escapes that build a word ($'\x67it').
# - Scanning is near-linear: LC_ALL=C and chunked parameter expansion instead of per-character slicing.
# - The hook's own git calls are hardened (no fsmonitor, no hooks, no optional locks) so a hostile repo given
#   via git -C cannot run code through the guard.

export LC_ALL=C
payload="$(cat 2>/dev/null || true)"
[ "${GIT_GUARDRAILS_OFF:-}" = "1" ] && exit 0
[ "${#payload}" -gt 262144 ] && exit 0

J_tool=""; J_cwd=""; J_cmd=""; J_args=""

jsonscan() { # jsonscan <json>: first string value of tool_name|toolName, cwd, command, toolArgs (keys outside strings only)
  local s="$1" n=${#1} i=0 j c ch nx hex key="" str win
  while [ "$i" -lt "$n" ]; do
    c="${s:i:1}"
    case "$c" in
      '"')
        i=$((i + 1)); str=""
        while [ "$i" -lt "$n" ]; do
          win="${s:i:512}"; ch="${win%%[\"\\]*}"
          if [ -n "$ch" ]; then str+="$ch"; i=$((i + ${#ch})); continue; fi
          ch="${s:i:1}"
          if [ "$ch" = '\' ]; then
            nx="${s:i+1:1}"; i=$((i + 2))
            case "$nx" in
              n) str+=$'\n' ;;
              t) str+=$'\t' ;;
              r) str+=$'\r' ;;
              b | f) ;;
              u) hex="${s:i:4}"; i=$((i + 4))
                case "$hex" in
                  000[aA]) str+=$'\n' ;;
                  0009) str+=$'\t' ;;
                  00[2-7][0-9a-fA-F]) printf -v ch "\\x${hex:2:2}"; str+="$ch" ;;
                  *) str+="?" ;;
                esac ;;
              *) str+="$nx" ;;
            esac
            continue
          fi
          [ "$ch" = '"' ] && break
          str+="$ch"; i=$((i + 1))
        done
        i=$((i + 1)); j=$i
        while [[ "${s:j:1}" == [[:space:]] ]]; do j=$((j + 1)); done
        if [ "${s:j:1}" = ":" ]; then
          key="$str"; i=$((j + 1))
        else
          case "$key" in
            tool_name | toolName) [ -n "$J_tool" ] || J_tool="$str" ;;
            cwd) [ -n "$J_cwd" ] || J_cwd="$str" ;;
            command) [ -n "$J_cmd" ] || J_cmd="$str" ;;
            toolArgs) [ -n "$J_args" ] || J_args="$str" ;;
          esac
          key=""
        fi ;;
      [[:space:]]) i=$((i + 1)) ;;
      *) key=""; i=$((i + 1)) ;;
    esac
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
[ "${#cmd}" -gt 65536 ] && exit 0
plain="${cmd//[\'\"\\]/}"
case "$plain" in *git*) ;; *) exit 0 ;; esac

[ -n "$cwd" ] && [ -d "$cwd" ] || cwd="$PWD"
hgit() { GIT_OPTIONAL_LOCKS=0 git -c core.fsmonitor=false -c core.hooksPath=/dev/null "$@"; }
top="$(hgit -C "$cwd" rev-parse --show-toplevel 2>/dev/null)"
[ -f "$cwd/.agents/guardrails.off" ] && exit 0
[ -n "$top" ] && [ -f "$top/.agents/guardrails.off" ] && exit 0

deny() {
  local r
  r="$(printf '%s' "$1" | tr -d '\000-\037')"
  r="${r//\\/\\\\}"; r="${r//\"/\\\"}"
  printf '{"permissionDecision":"deny","permissionDecisionReason":"%s","hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$r" "$r"
  exit 0
}
OPTOUT="set GIT_GUARDRAILS_OFF=1 or create .agents/guardrails.off to allow"

protected() { # protected <branch>: main or release/*
  local r="${1#refs/heads/}"
  case "$r" in main | release/*) return 0 ;; esac
  return 1
}
dirty() { # unknown state (moved, missing dir, failing status) counts as dirty
  local o
  { [ -n "$moved" ] || [ ! -d "$wd" ]; } && return 0
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
  local wd="$cwd" sub a d dst cur pf isdel force=0 del=0 skip=0 repo=0
  local -a args=() refs=() specs=()
  while [ $# -gt 0 ]; do # skip git global options
    case "$1" in
      -C)
        if [ $# -ge 2 ]; then case "$2" in /*) wd="$2" ;; *) wd="$wd/$2" ;; esac; fi
        shift $(($# >= 2 ? 2 : 1)) ;;
      -c | --git-dir | --work-tree | --namespace) shift $(($# >= 2 ? 2 : 1)) ;;
      -*) shift ;;
      *) break ;;
    esac
  done
  [ $# -gt 0 ] || return 0
  sub="$1"; shift
  args=("$@")
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
      cur="$(hgit -C "$wd" symbolic-ref --short HEAD 2>/dev/null)"
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
        { [ $isdel = 1 ] || [ $del = 1 ]; } && deny "git guardrails: deleting $dst on the remote is blocked ($OPTOUT)"
        [ $pf = 1 ] && deny "git guardrails: force push to $dst is blocked ($OPTOUT)"
      done ;;
    reset)
      has_arg --hard "${args[@]}" && deny "git guardrails: git reset --hard discards uncommitted work ($OPTOUT)" ;;
    clean)
      has_short n "${args[@]}" && return 0
      has_arg --dry-run "${args[@]}" && return 0
      { has_short f "${args[@]}" || has_arg --force "${args[@]}"; } && deny "git guardrails: git clean -f deletes untracked files ($OPTOUT)" ;;
    branch)
      for a in "${args[@]}"; do
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
      for a in "${args[@]}"; do case "$a" in . | :/ | \*) all=1 ;; --staged | -S) staged=1 ;; --worktree | -W) wt=1 ;; esac; done
      [ $all = 1 ] || return 0
      [ "$sub" = restore ] && [ $staged = 1 ] && [ $wt = 0 ] && return 0
      dirty && deny "git guardrails: git $sub . discards uncommitted changes ($OPTOUT)" ;;
  esac
  return 0
}

S=""; POS=0; moved=""; PD=0
SP_TOP=$'[ \t\n;|&(){}#<>\'"\\\\$`]'
SP_DQ='["\\$`]'

analyze() { # analyze <string> [dq]: inspect it as a shell script (dq: text of an unquoted heredoc body)
  local save="$S"
  S="$1"; parse "" 0 "${2:-}"
  S="$save"
}

is_assign() { [[ "$1" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; }

handle() { # handle <words...>: one simple command, quotes already removed
  local -a t=("$@")
  local i=0 n=$# w x
  while [ "$i" -lt "$n" ]; do
    w="${t[i]}"
    if is_assign "$w"; then i=$((i + 1)); continue; fi
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
      env)
        i=$((i + 1))
        while [ "$i" -lt "$n" ]; do
          x="${t[i]}"
          case "$x" in
            -S | --split-string) [ $((i + 1)) -lt "$n" ] && analyze "${t[i+1]}"; return ;;
            -u | -C | --unset | --chdir) i=$((i + 2)) ;;
            -*) i=$((i + 1)) ;;
            *) if is_assign "$x"; then i=$((i + 1)); else break; fi ;;
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
_endseg() { _flush; if [ ${#toks[@]} -gt 0 ]; then handle "${toks[@]}"; fi; toks=(); redir=0; herestr=0; }
_isshell() { # is the command collected so far a shell (a heredoc / here-string consumer)?
  local x
  for x in "${toks[@]}"; do
    is_assign "$x" && continue
    case "${x##*/}" in
      sudo | doas | env | command | exec | nohup | time | nice | setsid | timeout | xargs | -*) ;;
      bash | sh | zsh | dash | ksh | ash) return 0 ;;
      *) return 1 ;;
    esac
  done
  return 1
}
_arith_end() { # _arith_end <index of the first '(' of '((': sets AE to the index after the matching '))'
  local j=$1 d=0 c m=${#S}
  while [ "$j" -lt "$m" ]; do
    c="${S:j:1}"; j=$((j + 1))
    case "$c" in '(') d=$((d + 1)) ;; ')') d=$((d - 1)); [ "$d" -le 0 ] && break ;; esac
  done
  AE=$j
}

parse() { # parse <stop-char> <start> [dq]: depth-capped wrapper around _parse
  PD=$((PD + 1))
  if [ "$PD" -gt 24 ]; then POS=${#S}; else _parse "$@"; fi
  PD=$((PD - 1))
}

_parse() { # tokenize S, run handle per simple command, leave the end index in POS
  local stop="$1" i="$2" mode="${3:-}" n=${#S} c nx q="" w="" inw=0 redir=0 herestr=0 j pos rest line cmpl win chunk k body
  local -a toks=() hdd=() hdq=() hdt=() hds=()
  [ "$mode" = dq ] && q='"'
  while [ "$i" -lt "$n" ]; do
    win="${S:i:512}"
    case "$q" in
      "'") chunk="${win%%\'*}" ;;
      '"') chunk="${win%%$SP_DQ*}" ;;
      A) chunk="${win%%[\'\\]*}" ;;
      *) chunk="${win%%$SP_TOP*}" ;;
    esac
    if [ -n "$chunk" ]; then w+="$chunk"; [ -z "$q" ] && inw=1; i=$((i + ${#chunk})); continue; fi
    c="${S:i:1}"
    if [ "$q" = "'" ]; then
      if [ "$c" = "'" ]; then q=""; else w+="$c"; fi
      i=$((i + 1)); continue
    fi
    if [ "$q" = A ]; then # $'...': backslash escapes the next character
      if [ "$c" = '\' ]; then w+="${S:i+1:1}"; i=$((i + 1)); elif [ "$c" = "'" ]; then q=""; else w+="$c"; fi
      i=$((i + 1)); continue
    fi
    if [ "$q" = '"' ]; then
      case "$c" in
        '"') if [ "$mode" = dq ]; then w+="$c"; else q=""; fi ;;
        '\')
          nx="${S:i+1:1}"
          case "$nx" in
            '"' | '\' | '$' | '`') w+="$nx"; i=$((i + 1)) ;;
            $'\n') i=$((i + 1)) ;;
            *) w+="$c" ;;
          esac ;;
        '$')
          if [ "${S:i+1:1}" = "(" ]; then
            if [ "${S:i+1:2}" = "((" ]; then _arith_end $((i + 1)); i=$((AE - 1)); else parse ")" $((i + 2)); i=$((POS - 1)); fi
            w+="X"
          else w+="$c"; fi ;;
        '`') parse '`' $((i + 1)); i=$((POS - 1)); w+="X" ;;
        *) w+="$c" ;;
      esac
      i=$((i + 1)); continue
    fi
    case "$c" in
      "'") q="'"; inw=1 ;;
      '"') q='"'; inw=1 ;;
      '\')
        nx="${S:i+1:1}"
        if [ "$nx" != $'\n' ]; then w+="$nx"; inw=1; fi
        i=$((i + 1)) ;;
      '$')
        inw=1
        if [ "${S:i+1:1}" = "(" ]; then
          if [ "${S:i+1:2}" = "((" ]; then _arith_end $((i + 1)); i=$((AE - 1)); else parse ")" $((i + 2)); i=$((POS - 1)); fi
          w+="X"
        elif [ "${S:i+1:1}" = "'" ]; then q=A; i=$((i + 1))
        else w+="$c"; fi ;;
      '`')
        if [ "$stop" = '`' ]; then _endseg; POS=$((i + 1)); return; fi
        inw=1; parse '`' $((i + 1)); i=$((POS - 1)); w+="X" ;;
      ')')
        _endseg
        if [ "$stop" = ")" ]; then POS=$((i + 1)); return; fi ;;
      ' ' | $'\t') _flush ;;
      $'\n')
        _endseg
        if [ ${#hdd[@]} -gt 0 ]; then # read the bodies of the pending heredocs
          pos=$((i + 1)); rest="${S:pos}"
          for k in "${!hdd[@]}"; do
            body=""
            while [ -n "$rest" ]; do
              line="${rest%%$'\n'*}"
              if [ "$line" = "$rest" ]; then pos=$((pos + ${#rest})); rest=""; else rest="${rest#*$'\n'}"; pos=$((pos + ${#line} + 1)); fi
              cmpl="$line"
              [ "${hdt[k]}" = 1 ] && cmpl="${line#"${line%%[!$'\t']*}"}"
              [ "$cmpl" = "${hdd[k]}" ] && break
              body+="$line"$'\n'
            done
            if [ "${hds[k]}" = 1 ]; then analyze "$body"
            elif [ "${hdq[k]}" = 0 ]; then analyze "$body" dq; fi
          done
          hdd=(); hdq=(); hdt=(); hds=()
          i=$pos; continue
        fi ;;
      '(')
        if [ "$inw" = 0 ] && [ "${S:i:2}" = "((" ]; then _arith_end "$i"; i=$((AE - 1)); else _endseg; fi ;;
      \; | \| | \&) _endseg ;;
      '{' | '}') if [ "$inw" = 0 ]; then _endseg; else w+="$c"; fi ;;
      '#') if [ "$inw" = 0 ]; then while [ "$i" -lt "$n" ] && [ "${S:i+1:1}" != $'\n' ]; do i=$((i + 1)); done; else w+="$c"; fi ;;
      '<' | '>')
        if [ "${S:i:3}" = "<<<" ]; then
          _flush; _isshell && herestr=1; redir=1; i=$((i + 2))
        elif [ "${S:i:2}" = "<<" ]; then
          _flush
          j=$((i + 2)); k=0; body=""
          [ "${S:j:1}" = "-" ] && { k=1; j=$((j + 1)); }
          while [[ "${S:j:1}" == [' '$'\t'] ]]; do j=$((j + 1)); done
          pos=0
          while [ "$j" -lt "$n" ]; do
            case "${S:j:1}" in
              ' ' | $'\t' | $'\n' | \; | \| | \& | '(' | ')' | '<' | '>') break ;;
              "'" | '"' | '\') pos=1 ;;
              *) body+="${S:j:1}" ;;
            esac
            j=$((j + 1))
          done
          hdd+=("$body"); hdq+=("$pos"); hdt+=("$k")
          if _isshell; then hds+=(1); else hds+=(0); fi
          i=$((j - 1))
        else
          if [ "$inw" = 1 ] && [[ "$w" =~ ^[0-9]+$ ]]; then w=""; inw=0; fi # fd number: 2>file
          _flush; redir=1
          [ "${S:i:2}" = ">>" ] && i=$((i + 1))
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
