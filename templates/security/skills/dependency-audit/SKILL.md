---
name: "Dependency Audit"
description: "Audit dependencies for known vulnerabilities and outdated packages across ecosystems"
allowed-tools: ["codebase", "runCommands", "problems"]
model: claude-sonnet-4.6
---

# Dependency Audit

Use this skill to identify vulnerable, outdated, or unmaintained dependencies across any ecosystem.

## Stack
- **CLI:** `npm audit` / `yarn audit` (Node.js)
- **CLI:** `pip-audit` (Python, key commands: `pip-audit`, `pip-audit -r requirements.txt`)
- **CLI:** `dotnet list package --vulnerable` (.NET)
- **CLI:** `trivy` (containers + filesystems, key commands: `trivy image`, `trivy fs`)
- **CLI:** `snyk` (multi-ecosystem, key commands: `snyk test`, `snyk monitor`)
- **CLI:** `govulncheck` (Go, key commands: `govulncheck ./...`)

## Scan Commands by Ecosystem

```bash
# Node.js
npm audit --audit-level=high
npm outdated

# Python
pip-audit
pip-audit -r requirements.txt --fix  # auto-fix if possible

# .NET
dotnet list package --vulnerable
dotnet list package --outdated

# Go
govulncheck ./...

# Container images
trivy image my-app:latest
trivy fs --security-checks vuln .

# Multi-ecosystem (requires snyk auth)
snyk test
```

## Severity Thresholds

| CVSS | Severity | Action |
|---|---|---|
| 9.0–10.0 | Critical | Block merge, immediate fix |
| 7.0–8.9 | High | Fix before release |
| 4.0–6.9 | Medium | Fix in next sprint |
| 0.1–3.9 | Low | Track, fix opportunistically |

## Review Checklist

- [ ] No Critical or High CVEs in direct dependencies
- [ ] No Critical CVEs in transitive dependencies
- [ ] Lockfile committed (`package-lock.json`, `poetry.lock`, `go.sum`, etc.)
- [ ] Dependencies pinned (no `*` or `latest` in production)
- [ ] Unmaintained packages (no releases in 2+ years) flagged for replacement
- [ ] SBOM generated for release artifacts (`cyclonedx`, `syft`)

## Common Fixes

| Issue | Fix |
|---|---|
| CVE in dependency | `npm update <pkg>` / `pip install --upgrade <pkg>` |
| Dependency with no fix | Replace with maintained alternative |
| Unpinned `*` version | Lock to specific version in manifest |
| No lockfile | Run `npm install` / `pip freeze > requirements.txt` |

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
