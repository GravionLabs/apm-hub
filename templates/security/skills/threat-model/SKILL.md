---
name: "Threat Model"
description: "STRIDE threat modelling — identify threats, affected components, and mitigations"
allowed-tools: read search codebase changes problems
model: claude-sonnet-4.6
---

# Threat Model (STRIDE)

Use this skill when asked to perform threat modelling, security design review, or identify attack surface for a feature or system.

## STRIDE Framework

| Threat | Concern | Example Attack |
|---|---|---|
| **S**poofing | Authenticity | Forging JWT, impersonating a user |
| **T**ampering | Integrity | Modifying request body, replaying transactions |
| **R**epudiation | Non-repudiation | Deleting audit logs, deniable actions |
| **I**nformation Disclosure | Confidentiality | Leaking PII in error messages, log injection |
| **D**enial of Service | Availability | Resource exhaustion, unbounded queries |
| **E**levation of Privilege | Authorization | Parameter pollution, mass assignment |

## Process

1. **Identify components** — list entry points, data stores, trust boundaries
2. **Apply STRIDE** — for each component, evaluate each threat category
3. **Rate risk** — Likelihood × Impact (High/Med/Low)
4. **Define mitigations** — concrete technical controls per threat

## Output Format

```
## Threat Model: [Feature/Component]

### Components
- Entry points: ...
- Data stores: ...
- Trust boundaries: ...

### Threats

| ID | STRIDE | Component | Threat | Risk | Mitigation |
|---|---|---|---|---|---|
| T1 | Spoofing | /api/login | Credential stuffing | High | Rate limiting, MFA, account lockout |
| T2 | Tampering | Order service | Price manipulation | High | Server-side price validation |
| T3 | Info Disclosure | Error handler | Stack traces in prod | Med | Generic error responses |
```

## Common Mitigations

- **Spoofing** → Strong AuthN, MFA, short-lived tokens
- **Tampering** → Input validation, digital signatures, HMAC
- **Repudiation** → Immutable audit log, signed events
- **Info Disclosure** → Least privilege, encryption, generic errors
- **DoS** → Rate limiting, timeouts, circuit breakers
- **Elevation** → RBAC, authorization on every operation

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
