---
name: verify-project
description: 'Run build, tests and lint; report pass/fail with the first error. Use to verify a change or as the verify phase.'
context: fork
---

Phase: verify. Run checks on project. On Claude Code `context: fork` is the isolated context (the fork runs on the caller's model): callers invoke this skill directly, never through an `Agent` or the `reviewer` agent, which answers with a findings array and expects a review package. Build and test output stays in the fork, the caller receives only the JSON below.

## Steps

1. Load `detect-techstack`; use `packageManager` for the build command and `test` for the test skills. Then run `pwsh <detect-techstack dir>/scripts/Enable-Worktrees.ps1 -Check` (stack JSON as `-TechStack`): exit 1 means `.worktrees/` is not ignored somewhere; report its drift JSON as the first error (`status: fail`, `summary` names `Enable-Worktrees.ps1`)
2. Run the build with the detected package manager
3. For each skill in `test`, load it and run its test command; skill not installed → use the package manager's `test` script and put "install `<stack>@apm-hub`" in `summary`
4. Run lint/format per project conventions
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
- Run the build and the full suite exactly once per call; never start another agent, subagent or skill that runs them again (on Claude Code the fork is already the isolated context).
