---
name: Dependency Audit
description: Audit all project dependencies for known CVEs, outdated packages, and supply chain risks
mode: agent
tools: ["codebase", "runCommands", "problems"]
---

# Dependency Audit Workflow

Perform a comprehensive dependency security audit covering direct and transitive vulnerabilities.

## Step 1: Detect Ecosystem

Identify the project's package managers from manifest files:
- `package.json` / `package-lock.json` → Node.js (npm)
- `yarn.lock` → Node.js (yarn)
- `requirements.txt` / `pyproject.toml` / `Pipfile` → Python
- `*.csproj` / `*.sln` → .NET
- `go.mod` → Go
- `Gemfile` → Ruby
- `pom.xml` / `build.gradle` → Java/JVM

## Step 2: Run Vulnerability Scans

```bash
# Node.js
npm audit --audit-level=moderate
npm audit --json > npm-audit.json

# Python
pip-audit --output=json > pip-audit.json
# Or with requirements file:
pip-audit -r requirements.txt

# .NET
dotnet list package --vulnerable
dotnet list package --vulnerable --include-transitive

# Go
govulncheck ./...

# Container images
trivy image <image-name>:latest --format json
trivy fs . --security-checks vuln --format json

# Multi-ecosystem (requires snyk login)
snyk test --json > snyk-results.json
```

## Step 3: Review Results

For each finding, capture:
- Package name and version
- CVE identifier (e.g., `CVE-2024-12345`)
- CVSS score and severity
- Affected versions
- Fixed version (if available)
- Exploitation status (is there a known exploit?)

## Step 4: Assess Risk

| CVSS | Severity | Blocking? | Timeline |
|---|---|---|---|
| 9.0–10.0 | Critical | Yes — block merge | Fix immediately |
| 7.0–8.9 | High | Yes — block release | Fix before release |
| 4.0–6.9 | Medium | No | Next sprint |
| 0.1–3.9 | Low | No | Opportunistic |

**Mitigating factors that reduce effective risk:**
- Vulnerability only exploitable via network but app is internal-only
- Vulnerable code path not reachable from user input
- Defense-in-depth controls already mitigate the attack vector

## Step 5: Check Supply Chain Health

Beyond CVEs, review package hygiene:
- [ ] Lockfile present and committed (`package-lock.json`, `poetry.lock`, `go.sum`)
- [ ] No `*` or `latest` version pins in production manifests
- [ ] No packages abandoned for 2+ years with no security fixes
- [ ] No suspicious packages with typosquatting names
- [ ] SBOM generated for release artifacts

```bash
# Generate SBOM (CycloneDX)
npx @cyclonedx/cyclonedx-npm --output-file sbom.json
syft . -o cyclonedx-json=sbom.json
```

## Step 6: Report and Remediate

```markdown
## Dependency Audit Report

**Ecosystem:** Node.js / Python / .NET / Go
**Date:** YYYY-MM-DD
**Scanner:** npm audit / pip-audit / trivy

### Critical & High Findings
| Package | Version | CVE | CVSS | Fixed In | Action |
|---|---|---|---|---|---|
| lodash | 4.17.20 | CVE-2021-23337 | 7.2 (High) | 4.17.21 | `npm update lodash` |

### Recommendations
1. Run `npm audit fix` for auto-fixable vulnerabilities
2. Pin `lodash` to `^4.17.21` in `package.json`
3. Schedule quarterly dependency reviews
4. Add `npm audit --audit-level=high` to CI pipeline
```
