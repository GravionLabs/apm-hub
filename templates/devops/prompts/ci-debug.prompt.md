---
name: CI Debug
description: Diagnose failing GitHub Actions CI runs — fetch logs, identify root cause, and provide fixes
mode: agent
tools: ["codebase", "runCommands", "problems", "changes"]
---

# GitHub Actions CI Debug Workflow

Systematically diagnose and fix a failing CI run.

## Step 1: Identify the Failing Run

```bash
# List recent runs for this repo
gh run list --limit 10

# Or list for a specific workflow
gh run list --workflow ci.yml --limit 10

# Get details of the failing run
gh run view <RUN_ID>
```

Note: run ID, workflow name, triggering commit, and which jobs failed.

## Step 2: Fetch Failure Logs

```bash
# Show only failed step output (most useful)
gh run view <RUN_ID> --log-failed

# Download full logs for all jobs
gh run download <RUN_ID> --dir ./ci-logs

# Enable debug logging for next run (set as repo variable)
# Settings → Variables → New: ACTIONS_STEP_DEBUG = true
```

## Step 3: Categorize the Failure

### Category A: Code / Build failure
- Compiler errors, test failures, linting
- **Fix**: address in source code

### Category B: CI configuration error
- Wrong action version, missing step, incorrect expression
- **Fix**: fix `.github/workflows/*.yml`

### Category C: Environment / Infrastructure
- Secrets missing, permissions wrong, registry unreachable
- **Fix**: configure in GitHub Settings

### Category D: Flaky / transient
- Network timeout, rate limit, cache corruption
- **Fix**: rerun: `gh run rerun <RUN_ID> --failed`

## Step 4: Detailed Diagnostic per Category

### Permissions Issues
```yaml
# Check permissions in workflow — should be minimal
permissions:
  contents: read
  packages: write    # only if needed
  id-token: write    # only for OIDC

# Common errors:
# "Resource not accessible by integration" → add specific permission
# "403 on push to GHCR" → add packages: write
```

### OIDC Auth Failures
- Check IAM role trust policy: `StringLike aud` must match `sts.amazonaws.com`
- Branch/tag condition: `token.actions.githubusercontent.com:sub` must match actual ref
- Session duration too short for long jobs → increase `role-session-duration`

### Missing Secrets
```bash
# List configured secrets (names only, not values)
gh secret list
gh secret list --env production
```

### Dependency / Restore Failures
```bash
# Reproduce locally
npm ci --prefer-offline     # Node
pip install -r requirements.txt
dotnet restore
```

### Docker Build Failures
- `COPY failed: file not found` → check `.dockerignore`
- Cache evicted → registry cache (`type=registry`) is more reliable than GHA cache
- Multi-platform timeout → use matrix strategy for platforms

## Step 5: Apply Fix

Make the targeted fix (code, workflow, or settings), then:
```bash
# Rerun failed jobs only
gh run rerun <RUN_ID> --failed

# Or trigger fresh run
git push
```

## Step 6: Report

```markdown
## CI Debug Report

**Run ID:** [x]  
**Workflow:** [name]  
**Failure category:** Build / Config / Environment / Flaky

### Root Cause
[description of root cause]

### Fix Applied
[what was changed]

### Prevention
[how to prevent recurrence — e.g., pin action versions, add matrix strategy]
```
