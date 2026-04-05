---
name: Secrets Audit
description: Comprehensive scan for hardcoded secrets, leaked credentials, and insecure secret storage patterns
mode: agent
tools: ["codebase", "changes", "runCommands"]
---

# Secrets Audit Workflow

Perform a thorough secrets audit to detect hardcoded credentials, tokens, and insecure secret handling.

## Step 1: Automated Tooling

Run available scanners (use whichever are installed):

```bash
# gitleaks — scan full history
gitleaks detect --source . --verbose --report-format json --report-path gitleaks-report.json

# gitleaks — staged changes only
gitleaks protect --staged

# truffleHog — entropy + pattern scanning
trufflehog git file://. --only-verified --json

# detect-secrets — generate/update baseline
detect-secrets scan --update .secrets.baseline
detect-secrets audit .secrets.baseline
```

## Step 2: Manual Code Review

Inspect the codebase for:

**Credential patterns:**
- `password`, `passwd`, `pwd`, `secret`, `api_key`, `apikey`, `token`, `credential`
- `connectionString`, `conn_str`, `database_url`
- `-----BEGIN` (private keys)

**Token signatures:**
- `sk-`, `pk-` (OpenAI, Stripe)
- `AKIA` (AWS access key)
- `ghp_`, `github_pat_` (GitHub tokens)
- `eyJ` (JWT — if hardcoded, not from auth)
- `xoxb-`, `xoxp-` (Slack tokens)

**Config files in git:**
- `.env` files with real values
- `appsettings.json` / `appsettings.Development.json` with credentials
- `application.yml` / `application.properties`
- `*.pem`, `*.key`, `*.p12`, `*.pfx`

## Step 3: Repository Hygiene

Check git history:
```bash
# Check if a file was ever committed (even if removed)
git log --all --full-history -- "**/.env"
git log --all --full-history -- "**/*.pem"

# Search history for patterns
git log --all -S "password" --oneline
```

Check `.gitignore`:
```
.env
*.pem
*.key
*.p12
*.pfx
secrets/
**/local.settings.json
```

## Step 4: Verify Secret Storage

- [ ] Secrets loaded from environment variables or secret manager
- [ ] `.env.example` present with placeholder values (not real ones)
- [ ] CI/CD secrets stored in GitHub Secrets / Azure Key Vault / AWS Secrets Manager
- [ ] No secrets in `Dockerfile` `ARG` or `ENV` defaults

## Step 5: Report Findings

```markdown
## Secrets Audit Report

### Findings
| Severity | File | Line | Type | Recommendation |
|---|---|---|---|---|
| 🔴 Critical | config/db.js | 12 | Database password | Move to env var |
| 🟡 Medium | .env committed | — | API key | Remove from history, rotate key |

### Remediation
1. Rotate all exposed secrets immediately
2. Remove from git history: `git filter-repo --path <file> --invert-paths`
3. Add `.gitignore` entries
4. Configure pre-commit hook: `gitleaks protect --staged`

### Secure Pattern
```env
# .env.example (committed)
DATABASE_URL=postgresql://user:password@localhost/dbname

# .env (NOT committed — in .gitignore)
DATABASE_URL=postgresql://appuser:realpassword@prod-db.internal/appdb
```
```
