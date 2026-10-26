#!/usr/bin/env bash
# SessionStart hook (Claude Code): heal agent files that `apm install` or `apm update` left in the apm-hub source format.
# `apm` copies the agents of the `agents` package verbatim; their frontmatter is Copilot style (`tools: ['agent', 'read', ...]`
# plus a `metadata:` block with a `claude:` section) and `apmw sanitize -p claude` rewrites it for Claude Code. When that step
# is forgotten the orchestrator starts without tools and prints its tool calls as text. A Claude Code file that apmw sanitized
# never carries the top-level `metadata:` key (apmw strips it), so the hook needs no run-state of its own: it scans the
# frontmatter of ~/.claude/agents/*.md and <cwd>/.claude/agents/*.md for `metadata:` with a `claude:` sub-key, the signature
# of the source format. Other agent files (no `metadata:` or no `claude:` under it) never trigger a run.
# Clean files: no output. Unsanitized files and `apmw` on PATH: runs `apmw sanitize -p claude` (`-g` for the home directory)
# and reports the count as additionalContext. No `apmw`: reports the command to run. Claude Code watches the agent
# directories, so subagents pick the rewritten files up at their next dispatch; a primary agent (`claude --agent orchestrator`)
# was loaded before the hook ran and needs a restart, which the message says.
# Opt-out AGENT_SANITIZE_OFF=1. Every path exits 0; no network. Needs bash, awk, grep and sed; jq is optional.

[ "${AGENT_SANITIZE_OFF:-}" = "1" ] && exit 0
payload="$(cat 2>/dev/null || true)"

# cwd from the payload (jq when present, else a plain scan); the process cwd is the fallback
cwd=""
if command -v jq >/dev/null 2>&1; then
  cwd="$(printf '%s' "$payload" | jq -r '.cwd // empty' 2>/dev/null)"
else
  cwd="$(printf '%s' "$payload" | grep -oE '"cwd"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n 1 | sed -E 's/^"cwd"[[:space:]]*:[[:space:]]*"//; s/"$//; s#\\/#/#g; s#\\\\#\\#g')"
fi
[ -d "$cwd" ] || cwd="$PWD"

# unsanitized <file>: exit 0 when the frontmatter has a top-level `metadata:` with a `claude:` key below it
unsanitized() {
  awk '
    { sub(/\r$/, "") }
    NR == 1 { sub(/[[:space:]]+$/, ""); if ($0 != "---") exit 1; next }
    /^---[[:space:]]*$/ { exit (found ? 0 : 1) }
    /^metadata:[[:space:]]*$/ { m = 1; next }
    m && /^[^[:space:]]/ { m = 0 }
    m && /^[[:space:]]+claude:[[:space:]]*$/ { found = 1 }
    END { exit (found ? 0 : 1) }
  ' "$1" 2>/dev/null
}
# count <dir>: number of unsanitized *.md files in <dir> (0 when the directory is missing)
count() {
  local n=0 f
  [ -d "$1" ] || { echo 0; return; }
  for f in "$1"/*.md; do
    [ -f "$f" ] || continue
    unsanitized "$f" && n=$((n + 1))
  done
  echo "$n"
}
jesc() { # JSON string body: backslash, quote and the control characters a path can carry
  local s="$1"; s=${s//\\/\\\\}; s=${s//\"/\\\"}; s=${s//$'\n'/ }; s=${s//$'\r'/}; s=${s//$'\t'/ }; printf '%s' "$s"
}
squote() { local s="$1"; s=${s//\'/\'\\\'\'}; printf "'%s'" "$s"; } # single-quoted shell word

gdir="$HOME/.claude/agents"
pdir="$cwd/.claude/agents"
# the project directory is the home directory (session started in $HOME, symlinked or with a trailing slash): scan it once
if [ -d "$pdir" ] && [ -d "$gdir" ] && [ "$(cd "$pdir" && pwd -P)" = "$(cd "$gdir" && pwd -P)" ]; then pdir=""; fi
g="$(count "$gdir")"
p=0; [ -n "$pdir" ] && p="$(count "$pdir")"
[ "$g" -eq 0 ] && [ "$p" -eq 0 ] && exit 0

msg=""
if command -v apmw >/dev/null 2>&1; then
  healed=0; left=""
  if [ "$g" -gt 0 ]; then
    apmw sanitize -g -p claude >/dev/null 2>&1
    after="$(count "$gdir")"
    healed=$((healed + g - after))
    [ "$after" -gt 0 ] && left="$left apmw sanitize -g -p claude;"
  fi
  if [ "$p" -gt 0 ]; then
    (cd "$cwd" && apmw sanitize -p claude >/dev/null 2>&1)
    after="$(count "$pdir")"
    healed=$((healed + p - after))
    [ "$after" -gt 0 ] && left="$left (cd $(squote "$cwd") && apmw sanitize -p claude);"
  fi
  [ "$healed" -gt 0 ] && msg="apm-hub agents: $healed agent file(s) were in the unsanitized source format (apm ran without apmw); apmw sanitize -p claude rewrote them. Subagents use the rewritten files from their next dispatch; a primary agent started with --agent was loaded before this hook ran and needs a restart of Claude Code."
  [ -n "$left" ] && msg="${msg:+$msg }apmw sanitize failed for some files; run by hand:${left%;}"
else
  cmds=""
  [ "$g" -gt 0 ] && cmds="apmw sanitize -g -p claude"
  [ "$p" -gt 0 ] && cmds="${cmds:+$cmds; }apmw sanitize -p claude"
  msg="apm-hub agents: $((g + p)) agent file(s) are in the unsanitized source format (apm ran without apmw), so the orchestrator and its subagents start without tools. Install apmw (uv tool install apmw, or pipx install apmw), run: $cmds, then restart Claude Code."
fi
[ -n "$msg" ] || exit 0
printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$(jesc "$msg")"
exit 0
