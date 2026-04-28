---
name: common-ssdlc-codeql-suppression
description: "Creates a CodeQL suppression configuration (codeql-config.yml) and a rationale document (CODEQL-SUPPRESSION-RATIONALE.md) for verified false positive alerts. Also updates Azure Pipeline YAML files to reference the config. Use when security alerts are confirmed false positives backed by evidence of proper security controls. Preferred model: claude-sonnet-4.6."
model: claude-sonnet-4.6
allowed-tools: shell
---

## Purpose

Suppress CodeQL false positive alerts by:
1. Creating / updating `codeql-config.yml` at the repository root with exclusion rules
2. Creating / updating `CODEQL-SUPPRESSION-RATIONALE.md` with documented evidence
3. Updating Azure Pipeline YAML files to reference the CodeQL config file

This skill must **only** be used after confirming alerts are genuinely false positives with evidence of proper security controls already in place.

---

## Inputs (provided by the caller)

- **False positive alerts list** — structured list of:
  - Alert rule ID (e.g., `cs/log-forging`)
  - Alert count
  - Evidence/reason why it is a false positive
  - Code examples demonstrating security controls
- **Repo local path** — e.g., `C:/SOURCE_CONTROL/Generation and Operations/MyRepo`
- **Work item ID** — for traceability

---

## Step 1 — Create or Update `codeql-config.yml`

Check if `codeql-config.yml` already exists at repo root:

```powershell
Test-Path "<repo-path>/codeql-config.yml"
```

**If it does not exist**, create it:

```yaml
name: "Custom CodeQL config"
query-filters:
  - exclude:
      id: <rule-id-1>
  - exclude:
      id: <rule-id-2>
```

**If it already exists**, read its content and append the new rule IDs without duplicating existing ones.

> Use only the rule IDs provided by the caller. Do not add rules speculatively.

---

## Step 2 — Create or Update `CODEQL-SUPPRESSION-RATIONALE.md`

Create a comprehensive rationale document at repo root. If it already exists, append a new dated section.

**Document template:**

```markdown
# CodeQL Suppression Rationale

> **Work Item:** #{work-item-id}  
> **Date:** {current-date}  
> **Standards:** RWE SSDLC, OWASP Top 10, CWE

This document explains why specific CodeQL alerts are suppressed. All suppressions
represent verified **false positives** — the underlying security controls are
properly implemented in the codebase.

---

## Suppressed Rules

### `{rule-id}` — {alert-name} ({count} alerts)

**Reason for Suppression:** {reason}

**Security Controls Verified:**
{bullet list of controls present}

**Code Evidence:**
```{language}
{code example showing the security control}
```

**RWE Compliance:** {which RWE standard is satisfied and how}  
**OWASP / CWE:** {reference}

---
```

Populate each section with the actual evidence provided by the caller.

---

## Step 3 — Update Azure Pipeline YAML Files

Find all pipeline YAML files in the repository:

```powershell
Get-ChildItem -Path "<repo-path>" -Recurse -Include "azure-pipelines*.yml","*.pipeline.yml" | Select-Object FullName
```

For each pipeline file that references `PipelineTemplates` build templates (look for `@PipelineTemplates`), add the `CodeQlConfigFilepath` parameter if it is not already present:

**Pattern to find:**
```yaml
- template: <any-template-name>.yml@PipelineTemplates
  parameters:
    <existing-params>
```

**Transformation — add the parameter:**
```yaml
- template: <any-template-name>.yml@PipelineTemplates
  parameters:
    <existing-params>
    CodeQlConfigFilepath: 'codeql-config.yml'
```

> Assume ALL templates from the `PipelineTemplates` repository support the `CodeQlConfigFilepath` parameter.

If no pipeline files are found, document this in the output and skip this step.

---

## Step 4 — Verify and Report

```powershell
# Confirm files exist
Test-Path "<repo-path>/codeql-config.yml"
Test-Path "<repo-path>/CODEQL-SUPPRESSION-RATIONALE.md"
```

Report:

```
✅ CodeQL Suppression Complete
  codeql-config.yml:              Created/Updated with <N> rule exclusions
  CODEQL-SUPPRESSION-RATIONALE.md: Created/Updated (<line-count> lines)
  Pipeline files updated:          <list of files> (or "None found")

Suppressed Rules:
  - <rule-id>: <alert-name> (<count> alerts) — <one-line-reason>
```

---

## Rules

- **Never** suppress a rule without documented evidence from the caller.
- **Never** suppress rules that represent real vulnerabilities — confirm false positive status before proceeding.
- Do not add rules to `codeql-config.yml` beyond what the caller explicitly requests.
- The rationale document must name the work item ID and date for audit traceability.
- All suppressed rules must reference the relevant RWE standard and OWASP/CWE classification.
