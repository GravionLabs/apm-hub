---
name: common-ssdlc-compliance
description: "Validates changed .NET code against RWEST company SSDLC (Secure Software Development Lifecycle), Cryptography Controls, and Container Security policies. Runs automatically after implementation. Detects CRITICAL violations (MUST rules) and WARNINGS (SHOULD rules), fixes them, and re-validates until clean. Preferred model: Sonnet."
model: claude-sonnet-4.6
allowed-tools: shell
---

## Purpose

Validate all code changes against the mandatory RWEST security policies derived from:
- **SSDLC** — Secure Software Development Lifecycle (RWEST SSI)
- **Cryptography Controls and Key Management** v3.0 (RWE CHV-C)
- **Container Security Standard** v2.0 (RWE)

Violations of **MUST** rules are **CRITICAL** — they block the commit and must be fixed.
Violations of **SHOULD** rules are **WARNINGS** — they must be fixed if technically feasible.

---

## Step 1 — Identify Changed Files

```powershell
git diff HEAD --name-only
```

If no HEAD commit yet (first commit), use:
```powershell
git diff --cached --name-only
```

Focus review on `.cs`, `.csproj`, `.json`, `.yaml`, `.yml`, `.xml`, `.config`, `.env`, `Dockerfile*`, `docker-compose*` files only. Skip generated files (`.designer.cs`, `.g.cs`, migrations unless they contain hardcoded values).

---

## Step 2 — Run Automated Scanner

Run the `scan-ssdlc.ps1` script from this skill's directory, passing the list of changed files:

```powershell
$changedFiles = git diff HEAD --name-only
& "$SKILL_DIR/scan-ssdlc.ps1" -Files $changedFiles
```

This script performs pattern-based checks and outputs structured findings.

---

## Step 3 — Deep Semantic Review

For each changed file, perform a thorough AI-driven review against the full rule set below. The automated scanner catches obvious patterns; this step catches logic-level violations.

---

## Complete Rule Set

### 🔴 CRITICAL — MUST Rules (Blocking)

#### SSDLC-01 · No Hardcoded Secrets
**Rule**: All secrets MUST be stored in secure vaults. Hardcoding in source code is forbidden.  
**Check**: Search for:
- Connection strings containing `Password=`, `pwd=`, `User ID=`, `AccountKey=`, `SharedAccessKey=`
- API keys, tokens, credentials assigned to string literals (e.g., `var apiKey = "sk-..."`)
- `<add key="..." value="...">` config entries with secret-looking values
- Private key material (`-----BEGIN ...-----`)
- AWS/Azure/GCP credentials patterns  

**Fix**: Replace with `Environment.GetEnvironmentVariable()`, `IConfiguration` reading from Azure Key Vault / AWS Secrets Manager / Azure Pipeline Secret Variables, or `app.config`/`appsettings.json` referencing a vault.

---

#### SSDLC-02 · Input Validation
**Rule**: ALL input from users or external systems MUST be validated against a defined schema, sanitized, and securely deserialized.  
**Check**:
- Controller action parameters used directly in DB queries, file paths, or commands without validation
- Raw deserialization of external JSON/XML without schema validation (e.g., `JsonConvert.DeserializeObject<object>()` with no type constraints, `XmlSerializer` on untrusted input without DTD protection)
- `string.Format` or string interpolation directly in SQL queries
- Missing `[Required]`, `[StringLength]`, `[RegularExpression]` or FluentValidation on model inputs
- `Process.Start()` with user-controlled arguments  

**Fix**: Add `ModelState.IsValid` checks, FluentValidation, parameterized queries, input length/format constraints.

---

#### SSDLC-03 · Authentication and Authorization Enforcement
**Rule**: ALL application components MUST enforce authentication and authorization checks.  
**Check**:
- ASP.NET Core controllers or Minimal API endpoints missing `[Authorize]` attribute (or global auth middleware) that handle non-public data
- Actions that skip authorization via `[AllowAnonymous]` without documented reason
- Missing role/policy checks on sensitive operations (admin, delete, financial data)
- Authorization logic based on user-supplied data without server-side validation  

**Fix**: Add `[Authorize]` / `[Authorize(Policy = "...")]` or `[Authorize(Roles = "...")]`. Never trust client-supplied role claims directly.

---

#### SSDLC-04 · Forbidden Cryptographic Algorithms
**Rule**: Only approved algorithms may be used per the Cryptography Controls Standard.  
**FORBIDDEN**:
- Hash: `MD5` (`MD5.Create()`, `new MD5CryptoServiceProvider()`, `MD5.HashData()`) — use SHA-256 minimum
- Hash: `SHA1` (`SHA1.Create()`, `new SHA1Managed()`, `SHA1.HashData()`) — use SHA-256 minimum
- Symmetric: `DES.Create()`, `new DESCryptoServiceProvider()` — use AES-256
- Symmetric: `TripleDES.Create()`, `new TripleDESCryptoServiceProvider()` — use AES-256
- Symmetric: RC2, RC4 — use AES-256
- Any use of `RijndaelManaged` with key size < 256 bits

**REQUIRED**:
- Hash: SHA-256, SHA-384, SHA-512, SHA3-256, SHA3-384, SHA3-512
- Symmetric: AES-256 (`Aes.Create()` with `KeySize = 256`, mode: GCM or CTR or CBC)
- HMAC: HMAC-SHA-256 or higher
- Password hashing: PBKDF2 (`Rfc2898DeriveBytes` with SHA-256, ≥ 310,000 iterations), bcrypt, or Argon2  

**Fix**: Replace all forbidden usages with approved alternatives.

---

#### SSDLC-05 · Deprecated TLS / SSL Protocols
**Rule**: SSL 2.0, SSL 3.0, TLS 1.0, TLS 1.1 MUST NOT be used. Only TLS 1.2 and TLS 1.3.  
**Check**:
- `SslProtocols.Ssl2`, `SslProtocols.Ssl3`
- `SslProtocols.Tls` (= TLS 1.0), `SslProtocols.Tls11`
- `SecurityProtocolType.Ssl3`, `SecurityProtocolType.Tls` (1.0), `SecurityProtocolType.Tls11`
- `ServicePointManager.SecurityProtocol` set to anything other than Tls12 | Tls13
- `HttpClientHandler` with explicitly downgraded TLS  

**Fix**: Use `SslProtocols.Tls12 | SslProtocols.Tls13`. For .NET 6+, the default is already TLS 1.2/1.3 — remove explicit overrides that downgrade.

---

#### SSDLC-06 · No Cleartext Protocols for Sensitive Data
**Rule**: Cleartext protocols (HTTP, FTP, Telnet) MUST NOT be used to transmit sensitive data. All external API calls and data transfers must use HTTPS.  
**Check**:
- `HttpClient` base addresses using `http://` (not `https://`)
- Connection strings using `http://` for service endpoints containing credentials or sensitive data
- FTP usage without SFTP/FTPS  

**Fix**: Replace `http://` with `https://`. For `HttpClient`, enforce `DangerousAcceptAnyServerCertificateValidator = false` and HTTPS scheme.

---

#### SSDLC-07 · Confidential Data Encrypted at Rest
**Rule**: Confidential and Strictly Confidential data MUST be encrypted at rest.  
**Check**:
- Sensitive model properties (passwords, PII, financial data, medical data) stored without `[ProtectedPersonalData]` or application-level encryption
- Database columns for sensitive fields without encrypted storage approach
- File I/O writing sensitive data as plain text  

**Fix**: Apply application-level encryption using Azure Key Vault / AES-256 before persisting.

---

#### SSDLC-08 · No End-of-Support Components
**Rule**: End-of-support system components MUST NOT be used.  
**Check**:
- `.csproj` targeting `net5.0`, `net3.1`, `net3.0`, `net2.1`, `net2.0`, `net461` or earlier (check current [.NET EoS dates](https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core))
- NuGet packages with known EoS or deprecated status (e.g., `Newtonsoft.Json` < current, `Microsoft.AspNetCore.Mvc` 2.x standalone)  

**Fix**: Upgrade target framework and packages to supported versions.

---

#### SSDLC-09 · Minimum Key Lengths
**Rule**: Cryptographic key lengths must meet minimums per Cryptography Controls Standard (from 2023+):
- Symmetric (AES): 256 bits minimum
- RSA: 3072 bits minimum
- Elliptic Curve: 256–512 bits  

**Check**:
- `new RSACryptoServiceProvider(keySize)` with keySize < 3072
- `Aes.Create()` with `KeySize` set to 128 (acceptable only for TLS cipher suites — not for data encryption at rest)
- DSA key generation with insufficient key sizes  

**Fix**: Set appropriate key sizes per the standard.

---

### 🟡 WARNING — SHOULD Rules (Fix if Feasible)

#### SSDLC-W01 · Security Event Logging
**Rule**: Applications should log: authentication errors/failed login attempts, access blocked, administrative activities/changes.  
**Check**: Changed authentication or authorization code that doesn't include structured `ILogger<T>` logging for failure cases.  
**Fix**: Add `_logger.LogWarning(...)` / `_logger.LogError(...)` at auth failure and access-denied points.

---

#### SSDLC-W02 · No Sensitive Data in Logs
**Rule**: Sensitive data (passwords, tokens, PII) must not be logged in cleartext.  
**Check**: `_logger.Log*(...)` calls containing user passwords, API keys, tokens, full PII data.  
**Fix**: Redact or mask sensitive fields before logging. Never log credentials.

---

#### SSDLC-W03 · Secure Session Identifiers
**Rule**: Session identifiers must be cryptographically secure (not predictable).  
**Check**: Session IDs generated with `Random()`, sequential integers, or `Guid.NewGuid()` used as security tokens. Security tokens should use `RandomNumberGenerator.GetBytes()`.  
**Fix**: Use `RandomNumberGenerator.GetBytes(32)` or `Guid.NewGuid()` only for non-security correlation IDs.

---

#### SSDLC-W04 · Test Data Anonymization
**Rule**: Test data should be synthetic or anonymized. Confidential production data should not appear in test files.  
**Check**: Test files containing real-looking email addresses, full names, phone numbers, IBANs, SSNs, or production-looking connection strings.  
**Fix**: Replace with fake/generated test data.

---

#### SSDLC-W05 · Key Separation
**Rule**: Cryptographic keys should be used for a single purpose only.  
**Check**: Single key or key reference used for both encryption and signing, or across multiple data domains.  
**Fix**: Use dedicated keys per purpose.

---

## Step 4 — Report Findings

Group findings by severity:

```
CRITICAL VIOLATIONS (MUST — Blocking):
  [SSDLC-04] Forbidden algorithm MD5 in UserService.cs:47
  [SSDLC-01] Hardcoded API key in appsettings.json:12

WARNINGS (SHOULD — Fix if feasible):
  [SSDLC-W01] Missing security logging on auth failure in AuthController.cs:88

PASSED: [SSDLC-02, SSDLC-03, SSDLC-05, SSDLC-06, SSDLC-07, SSDLC-08, SSDLC-09]
```

---

## Step 5 — Fix All Findings

Fix ALL CRITICAL violations. Fix WARNING violations unless there is a documented architectural reason they cannot be resolved.

For each fix, note the rule ID and what was changed.

---

## Step 6 — Re-Validate

After fixes, re-run the automated scanner and repeat the semantic review of changed lines only:

```powershell
$changedFiles = git diff HEAD --name-only
& "$SKILL_DIR/scan-ssdlc.ps1" -Files $changedFiles
```

Repeat until zero CRITICAL violations remain (maximum 5 rounds).

---

## Step 7 — Report Outcome

```
✅ SSDLC Compliance: PASSED
   Critical violations fixed: <N>
   Warnings fixed: <N>
   Warnings accepted (with reason): <N>
   Rules checked: SSDLC-01 through SSDLC-09, SSDLC-W01 through SSDLC-W05
```

OR if max rounds reached with remaining criticals:
```
❌ SSDLC Compliance: BLOCKED
   Remaining critical violations: <list>
   Action required: Manual security review needed before commit
```

---

## Rules
- Never suppress a finding by commenting out or deleting the security check. Fix the root issue.
- If a CRITICAL violation cannot be fixed in code (e.g., requires infrastructure change), document it clearly and surface it to the user — do NOT silently ignore it.
- Treat warnings as blocking if they involve secrets, credential exposure, or data at rest.
