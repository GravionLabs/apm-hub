# Permissions: shell allowlists per harness

An `--unattended` run stops at the first permission prompt (spike #823, `docs/spikes/deliver.md` section 2). `deliver` and its subagents run four kinds of shell commands; each must be on the allowlist of the harness:

| Commands | Used by |
|:--|:--|
| the verify commands of the repository's `AGENTS.md` (build, test, format, lint) | implement and fix subagents |
| `git` (`fetch`, `switch`, `worktree`, `add`, `commit`, `rebase`, `push`, `diff`, `ls-remote`) | all |
| `gh` (`auth status`, `api`, `issue`, `pr`) | this session, `github-pull-request` |
| `herdr pane report-metadata` | only when the run is inside a herdr pane |

Replace the `pnpm` lines below with the commands of the repository's `AGENTS.md`. Force pushes stay denied: `deliver` never needs them.

Claude Code denies any command with a quoted `$(…)` substitution even when its prefix is allowed ("Quoted text in this command can't be checked before it runs"). Skill text and subagent prompts write simple commands only.

## Claude Code

`.claude/settings.json` of the repository, key `permissions.allow` (commit it, so every clone gets it). File edits of the subagents need `Edit` and `Write` here or `--permission-mode acceptEdits`.

```json
{
  "permissions": {
    "allow": [
      "Bash(git:*)",
      "Bash(gh auth status)",
      "Bash(gh api:*)",
      "Bash(gh issue:*)",
      "Bash(gh pr:*)",
      "Bash(herdr pane report-metadata:*)",
      "Bash(pnpm install)",
      "Bash(pnpm run build)",
      "Bash(pnpm test:*)",
      "Bash(pnpm vitest run:*)",
      "Bash(pnpm run format:*)",
      "Edit",
      "Write"
    ],
    "deny": ["Bash(git push --force:*)", "Bash(git push -f:*)", "Bash(gh pr merge --admin:*)"]
  }
}
```

Headless: `claude -p "/deliver <nr> --unattended"` reads the same file; `--allowedTools` adds entries for one run.

## OpenCode

`opencode.json` of the repository, key `permission.bash`. Patterns are globs; the last matching rule wins, so the catch-all comes first.

```json
{
  "permission": {
    "edit": "allow",
    "bash": {
      "*": "ask",
      "git *": "allow",
      "gh auth status": "allow",
      "gh api *": "allow",
      "gh issue *": "allow",
      "gh pr *": "allow",
      "herdr pane report-metadata*": "allow",
      "pnpm install": "allow",
      "pnpm run build": "allow",
      "pnpm test*": "allow",
      "pnpm vitest run *": "allow",
      "pnpm run format*": "allow",
      "git push --force*": "deny",
      "git push -f*": "deny",
      "gh pr merge --admin*": "deny"
    }
  }
}
```

Headless: `opencode run "/deliver <nr> --unattended"`. A rule left at `ask` stops the run.

## Copilot CLI

No project file: the allowlist is passed per run with `--allow-tool`. `shell(<command>)` allows the command with every subcommand and argument; `--deny-tool` wins over `--allow-tool`. `write` allows file edits.

```powershell
copilot -p "/deliver <nr> --unattended" `
  --allow-tool 'shell(git)' `
  --allow-tool 'shell(gh auth status)' `
  --allow-tool 'shell(gh api)' `
  --allow-tool 'shell(gh issue)' `
  --allow-tool 'shell(gh pr)' `
  --allow-tool 'shell(herdr pane report-metadata)' `
  --allow-tool 'shell(pnpm)' `
  --allow-tool 'write' `
  --deny-tool 'shell(git push --force)' `
  --deny-tool 'shell(git push -f)' `
  --deny-tool 'shell(gh pr merge --admin)'
```

Keep the call in a PowerShell script of the repository so the list lives next to the code like the other two files.
