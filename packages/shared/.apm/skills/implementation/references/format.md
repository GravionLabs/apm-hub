# Format changed files

`scripts/Format-Changed.ps1` formats (or checks) the changed files of a task. For `ts`, `ng`, `py`, `dotnet` and `rust` it knows the default commands; a `-Language` call needs no further parameters. The `## Format` section of each `<lang>-implementation` skill names the extensions and commands.

```powershell
pwsh scripts/Format-Changed.ps1 -Language ts
pwsh scripts/Format-Changed.ps1 -Language ts -Check
pwsh scripts/Format-Changed.ps1 -Extensions .ts,.tsx -Command 'npx prettier --write {files}'   # any other tool
```

Defaults, in order: ts/ng prettier then eslint (eslint only on `.ts .tsx .js .mjs .cjs`), py `uv run ruff format` then `uv run ruff check --fix`, dotnet `dotnet format --include`, rust `cargo fmt -- {files}`. `-Check` runs the read-only variants. Precedence: `.agents/format.json` entry, then explicit `-Extensions`/`-Command`, then these defaults.

Not configured: a tool that is missing or whose `-Requires` probe fails is skipped with `skipped: <tool> not configured` (`ruff`, `prettier`, `eslint`, `dotnet`, `cargo`); note it in the report. A tool configured in `.agents/format.json` that is missing is an error. The override and a JetBrains example (`jb cleanupcode`): `docs/usage/format-override.md`.

## Parameters

| Parameter | Meaning |
|:--|:--|
| `-Language` | Key into `.agents/format.json` and into the built-in defaults (`ts`, `ng`, `py`, `dotnet`, `rust`). With an entry or a default, `-Extensions`/`-Command` become optional. |
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
| Override tool not found | stderr `error: <tool> not found (configured in .agents/format.json for <lang>)`, nothing runs | 1 |
| `.agents/format.json` invalid JSON, or entry lacks the `format`/`check` key | stderr error naming file (and language, key) | 1 |
| Command fails | its stderr passes through | its exit code |
| Not a git repository | `skipped: not a git repository` | 0 |
| Success | `formatted: <n> files` / `checked: <n> files` | 0 |

## Override (.agents/format.json)

With `-Language <lang>` the script reads `<git toplevel>/.agents/format.json`:

```json
{ "dotnet": { "extensions": [".cs"], "format": "jb cleanupcode {files}", "check": ["jb inspectcode {files}", "jb chk"] } }
```

- An entry for `<lang>` replaces all default commands of the language (and `-Requires`); `extensions` replace `-Extensions` (absent: `-Extensions` stays). `-Check` selects `check`, otherwise `format`; each is a string or an array run in order on the same file list, the first non-zero exit stops.
- `{files}` as its own token expands to one argument per file; inside a token (`--include={files}`) the files are joined by `;`.
- The override ignores `-Command`/`-Requires`, so every call with the same `-Language` and mode runs the same override commands again. A skill with several calls (e.g. prettier + eslint) therefore repeats them; make the override commands idempotent, or call the script once per mode with `-Language` only.
- The script prints `notice: running commands from .agents/format.json` on stderr: the file is repo-controlled, review it like code.
- A tool configured there that is missing is an error, never a skip, even when no file changed. A missing mode key is an error too (no fallback to `-Command`).
- No entry for `<lang>`, other entries, or no `-Language`: the file is ignored and `-Extensions`/`-Command` apply (both then required).

## From a `## Format` section

The section names the extensions, the format command and the check command. Run `Format-Changed.ps1 -Language <lang>` after green tests and before the commit; the check command (with `-Check`) is what CI or the caller runs read-only.
