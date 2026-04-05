---
name: "Security Review"
description: "Structured security review against OWASP Top 10 — any language or framework"
allowed-tools: ["codebase", "changes", "problems"]
model: claude-sonnet-4.6
---

# Security Review

Perform a structured code security review when asked to check for vulnerabilities, security issues, or before merging security-sensitive changes.

## Review Checklist

**A01 — Broken Access Control** 🔴
- Authorization checked on every route/endpoint?
- No IDOR — user can only access their own resources?
- Principle of least privilege enforced?

**A02 — Cryptographic Failures** 🔴
- Sensitive data encrypted at rest and in transit?
- No MD5/SHA-1 for passwords — use bcrypt/scrypt/Argon2?
- TLS enforced, certificates validated?

**A03 — Injection** 🔴
- Parameterized queries / ORMs for all DB access?
- Input sanitized before shell commands, LDAP, XML?
- Output encoded to prevent XSS?

**A04 — Insecure Design**
- Sensitive operations rate-limited?
- Business logic flaws (negative amounts, step-skipping)?

**A05 — Security Misconfiguration**
- Debug mode / verbose errors disabled in production?
- Default credentials changed?
- Unnecessary features/ports disabled?

**A06 — Vulnerable Components**
- Dependencies up to date?
- No known CVEs in direct or transitive dependencies?

**A07 — AuthN/AuthZ Failures**
- Passwords hashed (not encrypted or plain)?
- Sessions invalidated on logout?
- MFA for privileged actions?

**A09 — Logging Failures**
- Security events logged (login, access denied, input failures)?
- No PII, tokens, or credentials in logs?

**A10 — SSRF**
- User-supplied URLs validated against allowlist?
- Internal network access blocked from external input?

## Output Format

```
## Security Review
**Risk Level:** Critical / High / Medium / Low

### Findings
| Severity | Category | Location | Issue | Fix |
|---|---|---|---|---|
| 🔴 Critical | A03-Injection | UserController.cs:42 | Raw SQL concat | Parameterized query |

### Recommendations
- ...
```

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
