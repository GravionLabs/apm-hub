---
name: verify-project
description: 'Run build, tests and lint; report pass/fail with the first error. Use to verify a change or as the verify phase.'
context: fork
---

Phase: verify. Run checks on project. On Claude Code this skill runs in a forked general-purpose context (never the `reviewer` agent, which answers with a findings array and expects a review package): build and test output stays there, the caller receives only the JSON below.

## Steps

1. Load `detect-techstack`; use `packageManager` for the build command and `test` for the test skills. Then run `pwsh <detect-techstack dir>/scripts/Enable-Worktrees.ps1 -Check` (stack JSON as `-TechStack`): exit 1 means `.worktrees/` is not ignored somewhere; report its drift JSON as the first error (`status: fail`, `summary` names `Enable-Worktrees.ps1`)
2. Run the build with the detected package manager
3. For each skill in `test`, load it and run its test command; skill not installed → use the package manager's `test` script and put "install `<stack>@apm-hub`" in `summary`
4. Run lint per project conventions. Format check: run each loaded `<lang>-implementation` `## Format` `Check:` command through the implementation skill's `scripts/Format-Changed.ps1 -Check -Base <integration branch>` (never the format command; it never writes). A non-zero exit is `status: fail`, `summary` names the check and the first file; not configured or `skipped:` → note it in `summary`
5. Rust: build with `cargo build`; tests via `rust-test`; lint with `cargo clippy --all-targets --all-features -- -D warnings` and `cargo fmt --all -- --check` (as in `rust-implementation`); Tauri: run the cargo commands in `src-tauri/` (the dir with `Cargo.toml` and `tauri.conf.json`) and, with the detected `packageManager` (`pnpm` shown), `pnpm tauri build` as the overall build (use `--no-bundle` for a faster check)

## Output (JSON only)

```json
{
  "phase": "verify",
  "status": "ok" | "fail",
  "summary": "pass | first error line if fail",
  "tests": "<passed>/<total>"
}
```

`tests` is the count of the full test run (`0/0` when no test ran). When the caller passes an output path (the PBI Final-Verify passes `<state>/<pbi>/verify.json`), the same JSON is also written to that file.

## Constraints

- Read-only verification: no edits, no fixes — report only (the only write is the JSON to a caller-given output path).
- Run commands in project root.
- Step fails? Stop, report first error.
- Output JSON only.
