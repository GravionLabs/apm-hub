# Mechanical vs full classification

Run before fanning out, only when the input is a local range or the working tree: `pwsh -NoProfile -File scripts/Classify-Diff.ps1 -Range "<base>..<head>"` (no range: working tree vs `HEAD`). It prints `{"mode","dimensions","reason"}`. Use `dimensions` as the fan-out list. Script fails, prints nothing or invalid JSON: use `full`.

**PR-number input** (`gh pr diff <nr>`) without an explicit, locally resolvable `<base>..<head>` range is always `full`: do not run the classifier (it would classify an unrelated local diff).

**Range safety**: use refs validated by git. A range starting with `-`, containing whitespace, or with a side that `git rev-parse --verify` rejects is `full`. Git runs with `--literal-pathspecs` and `--` before pathspecs. In working-tree mode (no `..`) any untracked file (`git ls-files --others --exclude-standard`) is `full`, because `git diff` cannot see it.

## Mechanical

Based on `git diff -M --raw` and `--numstat`. Mechanical only when every file is one of:

- a pure rename (`R100`) with unchanged file mode, any path;
- a **docs** file: prose only, i.e. `README*`/`CHANGELOG*` (`.md`, `.mdx`, `.txt`) or `docs/**/*.md|mdx`; a **manifest**: `apm.yml`, `marketplace.json`, `plugin.json`; or a **test file** (`tests/`, `*.test.*`, `*.spec.*`, `test_*`, `*_test.*`). Modified, or renamed with edits where source and destination are the same kind, and for test files passing the rule below (added or deleted test files are full),

and the changed lines (added + deleted) of the non-pure-rename files total at most **20** (`-MaxLines` overrides; keep it small, these edits should only mention the new name).

Never docs, always full on content change: agent/skill instruction markdown (`SKILL.md`, `AGENTS.md`, `*.agent.md`, `*.prompt.md`, `*.instructions.md`, anything under `.apm/`, `.github/`, `.claude/`, `skills/`), code or scripts under `docs/`, `requirements*.txt`, `package.json` and other dependency or script manifests. Also full: mode change, symlink, submodule, binary.

**Test-file rule** (`git diff -U100000` of the file): removed and added lines must pair up one to one, each pair must be identical after replacing identifier tokens, every replacement must map the same old token to the same new token (injective: two old tokens never share a new token), neither the old nor the new token may appear in any other line, and numbers, operators, keywords such as `true`/`false`/`null`/`const`, string literals and comments must not change. A change inside a quoted string or comment, a block comment or multi-line string line is full. A logic change (new assertion, changed value or call) fails the rule and the diff is full. Cannot prove it: full. Known limit: swapping one identifier for another (e.g. `toBe` to `toEqual`) is indistinguishable from a rename.

Mechanical dimensions: `correctness`, `spec`. `security` is added when any touched path (source and destination of a rename) matches auth, crypt, password, secret, token, oauth, login, http, network, socket, sql, query, database, jwt, session, cookie, permission, rbac, acl, cert, tls, ssl, cors, csrf, hash, apikey, `.github/workflows`, hook, Dockerfile, `.env`, migration or `public/`.

## Full (all five dimensions)

Everything else: content change in any other file, binary file, more lines than the threshold, empty diff, git or parse error, any script error, unsupported change type. Unsure means full.

The caller can force full with `-Force full`; in a prompt: "review full" or `--full`.
