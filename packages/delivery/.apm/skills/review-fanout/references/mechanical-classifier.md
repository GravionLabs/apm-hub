# Mechanical vs full classification

Run before fanning out: `pwsh -NoProfile -File scripts/Classify-Diff.ps1 -Range <base>..<head>` (no range: working tree vs `HEAD`). It prints `{"mode","dimensions","reason"}`. Use `dimensions` as the fan-out list. Script fails, prints nothing or invalid JSON: use `full`.

## Mechanical

Based on `git diff -M --name-status` and `--numstat`. Mechanical only when every file is one of:

- a pure rename (`R100`, no content change), any path;
- a docs file (`docs/`, `*.md`, `*.mdx`, `*.txt`), a manifest (`apm.yml`, `marketplace.json`, `plugin.json`, `package.json`) or a test file (`tests/`, `*.test.*`, `*.spec.*`, `test_*`, `*_test.*`) that is modified or renamed with edits and passes the test-file rule below (added or deleted test files are full),

and the changed lines (added + deleted) of the non-pure-rename files total at most **20** (`-MaxLines` overrides; keep it small, these edits should only mention the new name).

**Test-file rule** (`git diff -U0` of the file): removed and added lines must pair up one to one, each pair must be identical after replacing identifier tokens, every replacement must map the same old token to the same new token across the file, the old token must not remain in any added line, and numbers, strings' punctuation, operators and keywords such as `true`/`false`/`null` must not change. A logic change (new assertion, changed value or call) fails the rule and the diff is full. Cannot prove it: full. Known limit: swapping one identifier for another (e.g. `toBe` to `toEqual`) is indistinguishable from a rename.

Mechanical dimensions: `correctness`, `spec`. `security` is added when any touched path matches auth, crypto, password, secret, token, oauth, login, http, network, socket or SQL/query/database.

## Full (all five dimensions)

Everything else: content change in any other file, binary file, more lines than the threshold, empty diff, git or parse error, unsupported change type. Unsure means full.

The caller can force full with `-Force full`; in a prompt: "review full" or `--full`.
