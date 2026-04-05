---
name: "ci-debug"
description: "Diagnose failing GitHub Actions CI runs — parse logs, identify root causes, and suggest fixes"
allowed-tools: ["codebase", "runCommands", "problems"]
model: claude-sonnet-4.6
---

# CI Debug

Use this skill when a GitHub Actions workflow run fails and you need to identify the root cause.

## Stack
- **CLI:** `gh` — GitHub CLI (key commands: `gh run view`, `gh run download`, `gh run watch`)
- **CLI:** `gh run list`, `gh run view --log-failed`

## Fetch Failing Run Logs

```bash
# List recent workflow runs
gh run list --limit 10

# View details of a specific run
gh run view <RUN_ID>

# Show only failed step logs
gh run view <RUN_ID> --log-failed

# Download all logs for offline analysis
gh run download <RUN_ID>

# Watch a run in progress
gh run watch <RUN_ID>
```

## Diagnostic Decision Tree

### ❌ Build/Compile Failure
- Check compiler errors in the failed step log
- Common causes: missing package restore, wrong SDK version, breaking API change
- Fix: ensure correct SDK version in `global.json` or `uses: actions/setup-dotnet`

### ❌ Test Failure
- Find the test name and assertion message in logs
- Check if flaky (re-run: `gh run rerun <RUN_ID>`)
- Common: environment-dependent tests, timing issues, missing test data

### ❌ Permission / Auth Failure
- `403 Forbidden` or `token needs write permission` → check job `permissions:`
- OIDC errors → check cloud trust policy (branch/tag conditions)
- `secrets.GITHUB_TOKEN` limited on fork PRs — expected behavior

### ❌ Cache Miss / Dependency Install Failure
- Cache key stale → key must include lockfile hash
- Registry timeout → transient, rerun the job
- Package not found → check `.npmrc` / `nuget.config` registry config

### ❌ Docker Build Failure
- Layer cache miss → check `cache-from` / `cache-to` configuration
- `COPY` file not found → check `.dockerignore` blocking required files
- Platform mismatch → verify `--platform` argument

### ❌ Timeout
- Default timeout 6h → set `timeout-minutes:` on job or step
- Hung test / blocking prompt in CI → add `--no-interaction` flags

### ❌ Artifact Upload/Download Failure
- `path not found` → ensure the path exists before upload
- Upload/download mismatch → `name:` must match between upload and download steps

## Checklist for Persistent Failures

- [ ] Check run URL in PR for exact error message
- [ ] `gh run view <ID> --log-failed` for root cause
- [ ] Verify secrets/variables set in correct scope (repo vs environment)
- [ ] Re-run with debug logging: `ACTIONS_STEP_DEBUG: true` in repo vars
- [ ] Check if failure is on `main` too (regression) or only on PR

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
