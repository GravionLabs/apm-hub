---
applyTo: "**/*"
description: 'Security best practices: OWASP Top 10 2021, supply chain security, AI/LLM risks, secrets management, Zero Trust, and secure coding for any language'
---

# Security Guidelines

## OWASP Top 10 2021

| # | Category | Key Rule |
|---|---|---|
| A01 | Broken Access Control | Enforce authorization on every endpoint; deny by default |
| A02 | Cryptographic Failures | Encrypt sensitive data at rest and in transit; use TLS 1.2+ |
| A03 | Injection | Parameterized queries everywhere; sanitize all external inputs |
| A04 | Insecure Design | Rate-limit sensitive operations; validate business logic server-side |
| A05 | Security Misconfiguration | No debug in production; disable unused features and ports |
| A06 | Vulnerable Components | `npm audit` / `pip-audit` / `dotnet list package --vulnerable` in CI |
| A07 | Auth Failures | Hash passwords (bcrypt/scrypt/Argon2); invalidate sessions on logout |
| A08 | Data Integrity | Pin dependencies; verify package signatures; sign CI/CD artifacts |
| A09 | Logging Failures | Log security events; never log PII, tokens, or passwords |
| A10 | SSRF | Validate user-supplied URLs against an explicit allowlist |

## Secrets Management

- **Never hardcode** credentials, API keys, tokens, or connection strings in source
- Store secrets in: Azure Key Vault / AWS Secrets Manager / HashiCorp Vault / GitHub Secrets
- `.env` files must be in `.gitignore`; commit `.env.example` with placeholders only
- Use `gitleaks` or `detect-secrets` as a pre-commit hook
- Rotate any secret that was accidentally committed — rotation is mandatory, not optional

## Supply Chain Security

- Commit lockfiles (`package-lock.json`, `poetry.lock`, `go.sum`, `packages.lock.json`)
- Pin dependency versions — avoid `*`, `latest`, or overly wide ranges in production
- Run vulnerability scans in CI: block on Critical/High CVEs
- Generate SBOM for release artifacts (CycloneDX / SPDX format)
- Review dependencies for abandonment (no releases 2+ years → evaluate replacement)

## AI / LLM Security (OWASP LLM Top 10)

- **Prompt Injection (LLM01)**: Never interpolate untrusted user input directly into system prompts. Use a structured prompt template with a clear separation between instructions and user content.
- **Sensitive Information Disclosure (LLM06)**: Strip PII and internal system details before passing context to an LLM. Filter model output before returning to users.
- **Insecure Output Handling (LLM02)**: Treat LLM output as untrusted — validate and sanitize before rendering or executing.
- **Overreliance (LLM09)**: Do not trust LLM output for security decisions without human review or deterministic validation.

## Zero Trust Principles

- Authenticate every request — no implicit trust from network location
- Least privilege: grant minimum required permissions; revoke unused access
- Assume breach: design systems to limit lateral movement
- Verify explicitly: re-authenticate for high-value operations (payment, admin, data export)

## Input Validation

- Validate on the **server side** — client-side validation is UX only, not security
- Use allowlists over denylists where possible
- Reject, don't sanitize, for structural violations (malformed JSON, invalid UUID)
- HTML-encode output in web contexts; use parameterized queries for SQL

## Cryptography

- Passwords: `bcrypt` (cost ≥ 12), `scrypt`, or `Argon2id` — never MD5/SHA-1/SHA-256 for passwords
- Symmetric encryption: AES-256-GCM
- Asymmetric: RSA ≥ 2048 or ECDSA P-256+
- TLS: 1.2 minimum, 1.3 preferred; validate certificates

## Logging & Monitoring

- Log: login attempts (success + failure), access denied, input validation failures, privilege changes
- Do not log: passwords, tokens, full credit card numbers, SSNs, health data
- Structured logging (JSON) with correlation IDs for traceability
- Alert on: repeated failures, unusual access patterns, privilege escalation
