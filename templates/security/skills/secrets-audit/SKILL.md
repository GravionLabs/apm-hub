---
name: "Secrets Audit"
description: "Scan for hardcoded secrets, credentials, and insecure secret storage patterns"
allowed-tools: execute shell runCommands read search codebase changes problems
model: claude-sonnet-4.6
---

# Secrets Audit

Use this skill when reviewing code for hardcoded secrets, leaked credentials, or insecure secret handling patterns.

## Stack
- **CLI:** `gitleaks` (key commands: `gitleaks detect`, `gitleaks protect`)
- **CLI:** `truffleHog` (key commands: `trufflehog git`, `trufflehog filesystem`)
- **CLI:** `git-secrets` (key commands: `git secrets --scan`)
- **CLI:** `detect-secrets` (key commands: `detect-secrets scan`)

## Automated Scan

```bash
# gitleaks — scan repo history
gitleaks detect --source . --verbose

# gitleaks — scan only staged changes (pre-commit)
gitleaks protect --staged

# truffleHog — deep entropy/pattern scan
trufflehog git file://. --only-verified

# detect-secrets — generate baseline
detect-secrets scan > .secrets.baseline
```

## Manual Review Patterns

Look for these anti-patterns:

**Hardcoded credentials:**
```
password = "abc123"
api_key = "sk-..."
connectionString = "Server=...;Password=..."
```

**Insecure storage:**
- Secrets in `appsettings.json` / `application.yml` committed to git
- `.env` files not in `.gitignore`
- Secrets in environment variable defaults in `Dockerfile`

**Token patterns to check:**
- `Bearer ey...` (JWT)
- `sk-`, `pk-` (OpenAI, Stripe)
- `ghp_`, `github_pat_` (GitHub tokens)
- `AKIA` (AWS access keys)
- `-----BEGIN RSA PRIVATE KEY-----`

## Secure Patterns

| Bad | Good |
|---|---|
| `password = "secret"` | `password = Environment.GetEnvironmentVariable("DB_PASSWORD")` |
| `.env` in git | `.env` in `.gitignore`, use `.env.example` |
| Secrets in `appsettings.json` | Azure Key Vault / AWS Secrets Manager / HashiCorp Vault |
| Hardcoded in `Dockerfile` | `ARG` with no default, or runtime env vars |

## Checklist

- [ ] No secrets in source code or config files
- [ ] `.env`, `*.pem`, `*.key` in `.gitignore`
- [ ] `.secrets.baseline` maintained if using detect-secrets
- [ ] Pre-commit hook (`gitleaks protect --staged`) configured
- [ ] Secret rotation policy documented

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
