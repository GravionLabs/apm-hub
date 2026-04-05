---
name: "OWASP Audit"
description: "Focused OWASP Top 10 2021 audit — analyze one or more categories in depth"
allowed-tools: ["codebase", "changes", "problems"]
model: claude-sonnet-4.6
---

# OWASP Top 10 Audit

Use this skill for a deep-dive into specific OWASP Top 10 2021 categories. Reference the relevant category when auditing a component.

## OWASP Top 10 2021 — Quick Reference

| # | Category | Key Questions |
|---|---|---|
| A01 | Broken Access Control | IDOR? Missing authz checks? Privilege escalation? |
| A02 | Cryptographic Failures | Weak algorithms? Data in clear text? HTTP not HTTPS? |
| A03 | Injection | SQL/XSS/Command injection? Unsanitized inputs? |
| A04 | Insecure Design | No rate limiting? Bypassable business logic? |
| A05 | Security Misconfiguration | Default creds? Debug in prod? Overly permissive CORS? |
| A06 | Vulnerable & Outdated Components | CVEs in dependencies? Unmaintained packages? |
| A07 | Identity & Auth Failures | Weak passwords? No session expiry? No MFA? |
| A08 | Software & Data Integrity | Unsigned packages? CI/CD untrusted inputs? |
| A09 | Logging & Monitoring Failures | Security events not logged? Alerts missing? |
| A10 | SSRF | User-controlled URLs fetched? No allowlist? |

## Audit Focus Areas

### A01 — Broken Access Control
Verify every route has explicit authorization. Check for direct object references (IDOR), missing `403` returns, and role bypass through URL manipulation.

### A03 — Injection
Review all DB queries, shell calls, XML/LDAP operations. Confirm parameterized queries or ORMs everywhere. Check template rendering for XSS (HTML encoding, CSP headers).

### A06 — Vulnerable Components
Run `npm audit`, `pip-audit`, `dotnet list package --vulnerable`, or `trivy image`. Look for packages with known CVEs (CVSS ≥ 7.0 = High/Critical).

### A08 — Software & Data Integrity
Check CI/CD pipelines for untrusted inputs in `run:` steps. Verify dependency pinning (lockfiles present). Review for deserialization of untrusted data.

### A10 — SSRF
Any URL or hostname supplied by users? Validate against an explicit allowlist. Block access to `169.254.0.0/16` (cloud metadata) and internal subnets.

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
