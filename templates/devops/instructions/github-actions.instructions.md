---
applyTo: ".github/workflows/**/*.yml,.github/workflows/**/*.yaml"
description: "GitHub Actions best practices: permissions, OIDC, secrets, caching, action pinning, and workflow structure"
---

# GitHub Actions Guidelines

## Workflow Structure

- Use descriptive `name:` for workflows, jobs, and steps
- Set `on:` triggers precisely — avoid over-broad triggers like `push: branches: ['*']`
- Group related jobs logically; use `needs:` for sequential dependencies
- Set `timeout-minutes:` on jobs (default 6 hours is too long)

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
```

## Permissions (Least Privilege)

Always set permissions explicitly — default to read-only, add only what's needed:

```yaml
permissions:
  contents: read        # default — read repository

jobs:
  build:
    permissions:
      contents: read
      packages: write   # only if pushing to GHCR
```

| Permission | When to use |
|---|---|
| `contents: read` | Always — default for most jobs |
| `packages: write` | Pushing container images to GHCR |
| `id-token: write` | OIDC authentication to cloud providers |
| `pull-requests: write` | Posting PR comments |
| `checks: write` | Writing check run results |

- Never use `permissions: write-all`
- Never use `contents: write` unless the job commits to the repository

## Action Version Pinning

**Always pin actions to full commit SHA** — never use floating tags:

```yaml
# ✅ Correct — pinned to commit SHA
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2

# ❌ Wrong — floating tag, can be changed maliciously
- uses: actions/checkout@v4
- uses: actions/checkout@main
```

Use [pin-github-action](https://github.com/mheap/pin-github-action) or [Dependabot](https://docs.github.com/en/code-security/supply-chain-security/keeping-your-actions-up-to-date-with-dependabot) to keep pinned SHAs updated.

## OIDC Authentication (Recommended over Stored Credentials)

Use OIDC to authenticate to AWS, Azure, and GCP without storing long-lived credentials:

```yaml
permissions:
  id-token: write
  contents: read

- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@<SHA>
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
    aws-region: eu-west-1
    role-session-duration: 3600
```

**OIDC Trust Policy must be scoped** — restrict to specific branch, tag, or environment:
```json
"Condition": {
  "StringLike": {
    "token.actions.githubusercontent.com:sub": "repo:myorg/myrepo:ref:refs/heads/main"
  }
}
```

## Secrets Management

- Access secrets only via `${{ secrets.NAME }}` — never hardcode values
- **Injection risk**: never use `${{ github.event.inputs.* }}` in `run:` steps without sanitization
  ```yaml
  # ❌ Dangerous — command injection
  run: echo "${{ github.event.inputs.user_input }}"
  
  # ✅ Safe — pass as environment variable
  env:
    USER_INPUT: ${{ github.event.inputs.user_input }}
  run: echo "$USER_INPUT"
  ```
- Store environment-specific secrets in GitHub Environments, not repository secrets
- Rotate secrets regularly; use OIDC where possible to eliminate static credentials

## Caching

Key caches on lockfile hash for reliable cache hits:

```yaml
- uses: actions/cache@<SHA>
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-

- uses: actions/cache@<SHA>
  with:
    path: ~/.nuget/packages
    key: ${{ runner.os }}-nuget-${{ hashFiles('**/*.csproj') }}
```

## Environments (Production Gates)

Use GitHub Environments with required reviewers for production deployments:

```yaml
jobs:
  deploy-production:
    environment: production   # configured with required reviewers
    runs-on: ubuntu-latest
```

Configure at: **Settings → Environments → Required reviewers**

## Reusable Workflows

- Use `workflow_call` to DRY up repeated jobs
- Pass only required inputs/secrets — avoid `secrets: inherit` unless scope is understood
- Document inputs/outputs with `description:` fields

```yaml
on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
        description: 'Target environment (staging/production)'
    secrets:
      DEPLOY_TOKEN:
        required: true
```

## Common Pitfalls

| Pitfall | Rule |
|---|---|
| Floating action tags | Pin to full commit SHA |
| `pull_request_target` + secrets | Only use when required; scope permissions tightly |
| `contents: write` + untrusted input | Use `pull_request` (not `pull_request_target`) for untrusted forks |
| Long-lived cloud credentials | Replace with OIDC |
| No timeout | Set `timeout-minutes:` on every job |
| Secrets in `run:` | Pass via `env:` block |
