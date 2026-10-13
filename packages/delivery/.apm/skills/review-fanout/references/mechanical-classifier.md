# Mechanical vs full classification

`pwsh -NoProfile -File scripts/Classify-Diff.ps1 [-Range "<base>..<head>"] [-Force full] [-MaxLines 20]` prints `{"mode","dimensions","reason"}` and exits 0. No `-Range`: working tree vs `HEAD`. Use `dimensions` as the fan-out list. Script fails, prints nothing or invalid JSON: `full`.

**Ref safety**: run it only when both refs match `^[A-Za-z0-9._/@~^-]+$` and do not start with `-`; else `full` without running it. The script also rejects a range starting with `-`, containing whitespace, or with a side `git rev-parse --verify` rejects. Git runs with `--literal-pathspecs` and `--` before pathspecs. Working-tree mode: any untracked file is `full` (`git diff` cannot see it). A PR number without a local range is always `full`.

## Mechanical

Based on one `git diff -M --raw --numstat`. Mechanical only when every file is one of:

- a pure rename (`R100`) with unchanged mode, **provided** neither source nor destination is an instruction or auto-executed path (below);
- a **docs** file: `README*`/`CHANGELOG*` (`.md`, `.mdx`, `.txt`) or `docs/**/*.md|mdx`, modified, added or deleted (an added file must be mode 100644); a **manifest**: `apm.yml`, `marketplace.json`, `plugin.json`; or a **test file** (`tests/`, `*.test.*`, `*.spec.*`, `test_*`, `*_test.*`), modified or renamed with edits (source and destination of the same kind) and passing the test-file rule. Added or deleted test files are full.

The changed lines (added + deleted) of all non-pure-rename files together total at most **20** (`-MaxLines`).

**Always full** (also as pure rename source or destination): agent/skill instruction files (`SKILL.md`, `AGENTS.md`, `CLAUDE.md`, `*.agent.md`, `*.prompt.md`, `*.instructions.md`), anything under `.apm/`, `.github/`, `.claude/`, `.opencode/`, `.cursor/`, `.husky/`, `.vscode/`, `skills/`, `hooks/`, plus `.mcp.json`, `.npmrc`, `.yarnrc`, `.pre-commit-config.yaml`, `Makefile`, `setup.py`, `conftest.py`, `Dockerfile*`. Also full: content change in any other file (code, `package.json`, `requirements*.txt`, scripts under `docs/`), mode change, symlink, submodule, type change, binary.

**Test-file rule** (`git diff -U100000`): removed and added lines pair one to one and differ only by identifier tokens. Each replacement maps the same old token to the same new token (injective). A new token must not appear anywhere in the removed lines (any pair, so no merging onto an existing name and no `toBe(expected)` to `toBe(x)` tautology), nor in unchanged lines; an old token must not remain in added or unchanged lines. Numbers, operators, keywords (`true`, `const`, ...), string literals and comments must not change; block comments, JSDoc and multi-line strings are full; pure deletions and additions are full. Cannot prove it: full. Known limit: swapping one identifier for another (`toBe` to `toEqual`) looks like a rename.

## Dimensions

Mechanical runs `correctness` and `spec`. `security` is added when:

- any touched path (source and destination) matches auth, crypt, password, secret, token, oauth, login, http, network, socket, sql, query, database, jwt, session, cookie, permission, rbac, acl, cert, tls, ssl, cors, csrf, hash, apikey, `.github/workflows`, hook, Dockerfile, `.env`, migration or `public/`;
- any manifest (`apm.yml`, `marketplace.json`, `plugin.json`) changed: it stays mechanical (cheap renames) but dependency or source edits get a security look;
- any added line contains a command or URL pattern: `curl`, `wget`, `http://`, `https://`, `| sh`, `| bash`, `eval`, `Invoke-Expression`, `iex`, `chmod`, `sudo`.

## Full (all five dimensions)

Everything else: other content change, binary, more lines than the threshold, empty diff, git or parse error, script error, unsupported change type. Unsure means full. `-Force full` skips classification.
