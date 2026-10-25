# Format changed files

`scripts/Format-Changed.ps1` formats (or checks) the changed files of a task. It holds no language knowledge: the caller passes extensions and the command, normally taken from the `## Format` section of the `<lang>-implementation` skill.

```powershell
pwsh scripts/Format-Changed.ps1 -Extensions .ts,.tsx -Command 'npx prettier --write {files}'
pwsh scripts/Format-Changed.ps1 -Extensions .ts,.tsx -Command 'npx prettier --check {files}' -Check
```

## Parameters

| Parameter | Meaning |
|:--|:--|
| `-Extensions` | Extensions to keep (`.ts`, `.tsx`; comma-separated string or array; the dot is optional). |
| `-Command` | Command line with a `{files}` placeholder (files appended when absent). Each file is its own argument, repo-relative; never `.` or a directory. |
| `-Requires` | Optional probe command that must exit 0 (e.g. `npx --no-install prettier --version`); otherwise `skipped: <tool> not configured`, exit 0. Makes "tool not configured" skip even behind `npx`/`uv`/`dotnet`. |
| `-Check` | Read-only intent: the command is the check command; success prints `checked`. |
| `-Base <ref>` | Also include files changed in `<ref>...HEAD`. Default: uncommitted changes only (staged, unstaged, untracked). Deleted files are dropped. |

## Outcomes

| Situation | stdout | Exit |
|:--|:--|:--|
| No changed file with a listed extension (or only other extensions) | `skipped: no changed files` | 0 |
| `-Requires` probe fails | `skipped: <tool> not configured` | 0 |
| First token of `-Command` not found | `skipped: <tool> not found` (note it in the report) | 0 |
| `-Base` ref invalid or git fails | git's error on stderr | non-zero |
| Command fails | its stderr passes through | its exit code |
| Not a git repository | `skipped: not a git repository` | 0 |
| Success | `formatted: <n> files` / `checked: <n> files` | 0 |

## From a `## Format` section

The section names the extensions, the format command and the check command. Run the format command with `-Extensions`/`-Command` after green tests and before the commit; the check command (with `-Check`) is what `verify-project` runs read-only.
