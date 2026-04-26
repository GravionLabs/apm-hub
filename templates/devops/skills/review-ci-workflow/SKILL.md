---
name: "review-ci-workflow"
description: "Review a GitHub Actions CI/CD workflow file for correctness, security, and best practices"
allowed-tools: read search codebase changes problems
model: claude-sonnet-4.6
---

# CI Workflow Review

Use this skill when asked to review a GitHub Actions workflow for correctness, security, or best practices.

## Review Checklist

### Structure & Correctness
- [ ] `on:` triggers appropriate for the workflow purpose
- [ ] Job dependencies (`needs:`) correctly ordered
- [ ] `runs-on` uses supported runner (ubuntu-latest / windows-latest / self-hosted)
- [ ] Steps have meaningful `name:` values
- [ ] `continue-on-error:` used intentionally (not to suppress failures)

### Permissions (Least Privilege)
- [ ] Top-level `permissions:` sets `contents: read` as default
- [ ] Individual jobs explicitly grant only what they need
- [ ] `id-token: write` only in jobs that use OIDC (e.g., cloud deploys)
- [ ] No `permissions: write-all`

### Secrets & Security
- [ ] Secrets accessed via `${{ secrets.NAME }}` — never hardcoded
- [ ] No `${{ github.event.inputs.* }}` used in `run:` without sanitization (injection risk)
- [ ] Third-party actions pinned to a full commit SHA (not floating tags like `@v3`)
- [ ] No `pull_request_target` with access to secrets unless intended and scoped

### OIDC Authentication (Cloud Deploys)
- [ ] AWS/Azure/GCP auth uses OIDC (`id-token: write`) — not long-lived service account keys
- [ ] OIDC trust policies scoped to specific branch / tag (not `ref: *`)

### Caching & Performance
- [ ] Dependency caches (`actions/cache`) keyed on lockfile hash
- [ ] Parallel jobs where possible; sequential only when `needs:` required
- [ ] No redundant checkout or install steps

### Reusable Workflows
- [ ] Caller passes all required `inputs:` and `secrets:`
- [ ] `secrets: inherit` used only when scope is understood

## Output Format

```
## CI Workflow Review: [filename]

### ✅ Looks Good
- ...

### ⚠️ Issues Found
| Severity | Location | Issue | Fix |
|---|---|---|---|
| 🔴 | job: deploy, step: auth | Hardcoded AWS key | Use OIDC with id-token: write |
```

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
