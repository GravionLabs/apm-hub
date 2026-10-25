# Format override

By default the `## Format` section of each `<lang>-implementation` skill decides how changed files are formatted and checked. A project can replace these commands per language with `.agents/format.json`, for example to use JetBrains tools.

## Schema

```json
{
  "dotnet": {
    "extensions": [".cs"],
    "format": "jb cleanupcode --include={files} MySolution.sln",
    "check": ["jb inspectcode MySolution.sln --include={files} --output=.agents/inspect.xml"]
  }
}
```

- Key: the language (`ts`, `ng`, `py`, `dotnet`, ...), as passed with `-Language` by the language skill.
- `extensions`: files to keep (optional; absent keeps the skill's extensions).
- `format`: command for the format step; `check`: command for the read-only check (`verify-project`). Each is a string or an array run in order; the first non-zero exit stops. `{files}` is replaced by the changed files, repo-relative, one argument each.

## Precedence

An entry for a language replaces all default commands of that language. With an entry the script runs once per mode with `-Language <lang>` only. Languages without an entry keep their defaults; entries for other languages are ignored.

## Errors

- A configured tool that is not installed is an error (exit 1), never a skip or fallback.
- An entry without the `format` key (or `check` key in check mode) is an error; there is no fallback to the default command.
- Invalid JSON in `.agents/format.json` is an error naming the file.

## Commit the file

`.agents/` holds installed skills. When the project ignores `.agents/`, add `!.agents/format.json` to `.gitignore` so the override is committed.

## JetBrains example (.NET)

Install the tools once:

```powershell
dotnet tool install -g JetBrains.ReSharper.GlobalTools
```

- Format: `jb cleanupcode --include={files} MySolution.sln`
- Check: `jb inspectcode MySolution.sln --include={files} --output=.agents/inspect.xml`, or run the format command and then `git diff --exit-code` (`cleanupcode` has no read-only mode):

```json
{
  "dotnet": {
    "extensions": [".cs"],
    "format": "jb cleanupcode --include={files} MySolution.sln",
    "check": ["jb cleanupcode --include={files} MySolution.sln", "git diff --exit-code"]
  }
}
```

See `references/format.md` of the `implementation` skill for the script parameters.
