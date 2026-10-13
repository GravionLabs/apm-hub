#!/usr/bin/env bash
# PreToolUse hook: deny destructive git commands before they run. Claude Code (tool_name Bash,
# tool_input.command) and Copilot CLI (toolName, toolArgs) payloads. Everything else passes (exit 0, no output).
# Adapted from mattpocock/skills git-guardrails-claude-code (MIT, https://github.com/mattpocock/skills).
# Opt-out per repo: GIT_GUARDRAILS_OFF=1, or an (empty) file .agents/guardrails.off in the working tree.

payload="$(cat 2>/dev/null || true)"
[ "${GIT_GUARDRAILS_OFF:-}" = "1" ] && exit 0

have_jq=0; command -v jq >/dev/null 2>&1 && have_jq=1
jfield() { printf '%s' "$payload" | jq -r "$1 // empty" 2>/dev/null; }

if [ "$have_jq" = 1 ]; then
  tool="$(jfield '.tool_name // .toolName')"
  cwd="$(jfield '.cwd')"
  cmd="$(jfield '.tool_input.command')"
  if [ -z "$cmd" ]; then # Copilot: toolArgs is a JSON string (or an object)
    cmd="$(printf '%s' "$payload" | jq -r '.toolArgs | if type=="string" then (try fromjson catch {}) else . end | .command // empty' 2>/dev/null)"
  fi
else # no jq: scan the raw payload with escaped quotes undone (may over-block, never under-blocks)
  tool="$(printf '%s' "$payload" | sed -n 's/.*"\(tool_name\|toolName\)"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\2/p' | head -n 1)"
  cwd="$(printf '%s' "$payload" | sed -n 's/.*"cwd"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
  cmd="$(printf '%s' "$payload" | sed 's/\\"/"/g')"
fi
case "$(printf '%s' "$tool" | tr '[:upper:]' '[:lower:]')" in bash|shell|powershell|run_shell_command|'') ;; *) exit 0 ;; esac
case "$cmd" in *git*) ;; *) exit 0 ;; esac

[ -n "$cwd" ] && [ -d "$cwd" ] || cwd="$PWD"
top="$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null)"
[ -f "$cwd/.agents/guardrails.off" ] && exit 0
[ -n "$top" ] && [ -f "$top/.agents/guardrails.off" ] && exit 0

deny() {
  local r="${1//\"/\'}"
  printf '{"permissionDecision":"deny","permissionDecisionReason":"%s","hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$r" "$r"
  exit 0
}

protected() { # protected <ref>: main or release/*
  local r="${1#+}"; r="${r##*:}"; r="${r#refs/heads/}"
  case "$r" in main|release/*) return 0 ;; esac
  return 1
}
dirty() { [ -n "$moved" ] || [ -n "$(git -C "$cwd" status --porcelain 2>/dev/null)" ]; }
has_short() { # has_short <letter> <args...>: a short-option cluster containing the letter
  local l="$1" a; shift
  for a in "$@"; do case "$a" in --*) ;; -*"$l"*) return 0 ;; esac; done
  return 1
}

check() { # check <tokens...> of one git invocation (after the word git)
  local args=() a sub="" pos=() force=0 del=0 t
  while [ $# -gt 0 ]; do # skip git global options
    case "$1" in
      -C|-c|--git-dir|--work-tree|--namespace) shift 2 ;;
      -*) shift ;;
      *) break ;;
    esac
  done
  sub="$1"; shift
  args=("$@")
  for a in "${args[@]}"; do case "$a" in -*) ;; *) pos+=("$a") ;; esac; done
  case "$sub" in
    push)
      for a in "${args[@]}"; do case "$a" in --force|--force-with-lease|--force-with-lease=*|--force-if-includes) force=1 ;; --delete) del=1 ;; --*) ;; -*) case "$a" in *f*) force=1 ;; esac; case "$a" in *d*) del=1 ;; esac ;; esac; done
      for a in "${pos[@]:1}"; do case "$a" in +*) force=1 ;; esac; done
      [ $force = 1 ] || [ $del = 1 ] || { for a in "${pos[@]:1}"; do case "$a" in :*) del=1 ;; esac; done; }
      [ $force = 1 ] || [ $del = 1 ] || return 0
      if [ "${#pos[@]}" -le 1 ] && [ $del = 0 ]; then # pushes the current branch
        t="$(git -C "$cwd" symbolic-ref --short HEAD 2>/dev/null)"
        protected "$t" && deny "git guardrails: force push of $t is blocked (set GIT_GUARDRAILS_OFF=1 or create .agents/guardrails.off to allow)"
      fi
      for a in "${pos[@]:1}"; do
        protected "$a" && { [ $del = 1 ] && deny "git guardrails: deleting $a on the remote is blocked (set GIT_GUARDRAILS_OFF=1 or create .agents/guardrails.off to allow)"
          case "$a" in :*) deny "git guardrails: deleting ${a#:} on the remote is blocked (set GIT_GUARDRAILS_OFF=1 or create .agents/guardrails.off to allow)" ;; esac
          [ $force = 1 ] && deny "git guardrails: force push to $a is blocked (set GIT_GUARDRAILS_OFF=1 or create .agents/guardrails.off to allow)"; }
      done ;;
    reset)
      for a in "${args[@]}"; do [ "$a" = "--hard" ] && deny "git guardrails: git reset --hard discards uncommitted work (set GIT_GUARDRAILS_OFF=1 or create .agents/guardrails.off to allow)"; done ;;
    clean)
      has_short n "${args[@]}" && return 0
      printf '%s\n' "${args[@]}" | grep -qx -- '--dry-run' && return 0
      { has_short f "${args[@]}" || printf '%s\n' "${args[@]}" | grep -qx -- '--force'; } && deny "git guardrails: git clean -f deletes untracked files (set GIT_GUARDRAILS_OFF=1 or create .agents/guardrails.off to allow)" ;;
    branch)
      { has_short D "${args[@]}" || { printf '%s\n' "${args[@]}" | grep -qx -- '--delete' && printf '%s\n' "${args[@]}" | grep -qx -- '--force'; }; } \
        && deny "git guardrails: git branch -D force-deletes a branch (set GIT_GUARDRAILS_OFF=1 or create .agents/guardrails.off to allow)" ;;
    checkout|restore)
      local all=0 staged=0 wt=0
      for a in "${args[@]}"; do case "$a" in .|:/|\*) all=1 ;; --staged|-S) staged=1 ;; --worktree|-W) wt=1 ;; esac; done
      [ $all = 1 ] || return 0
      [ "$sub" = restore ] && [ $staged = 1 ] && [ $wt = 0 ] && return 0
      dirty && deny "git guardrails: git $sub . discards uncommitted changes (set GIT_GUARDRAILS_OFF=1 or create .agents/guardrails.off to allow)" ;;
  esac
  return 0
}

moved=""
while IFS= read -r seg; do
  seg="${seg//[\"\']/}"
  read -ra tok <<<"$seg"
  i=0
  while [ $i -lt ${#tok[@]} ]; do # skip env assignments and wrappers
    case "${tok[$i]}" in *=*|sudo|command|time|exec|then|do|else|'!') i=$((i + 1)) ;; *) break ;; esac
  done
  [ $i -lt ${#tok[@]} ] || continue
  case "${tok[$i]##*/}" in
    cd|pushd) moved=1 ;;
    git) [ $((i + 1)) -lt ${#tok[@]} ] && check "${tok[@]:$((i + 1))}" ;;
  esac
done < <(printf '%s\n' "$cmd" | sed 's/&&/\n/g; s/||/\n/g; s/[;|&(){}]/\n/g')
exit 0
