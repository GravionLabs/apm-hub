---
name: helm-template-validate
description: 'Validate a Helm chart locally: lint, template rendering, schema validation, and optional kubeval or helm-unittest checks — no cluster required.'
allowed-tools: codebase runCommands
model: gpt-4.1
---

Validate a Helm chart locally without a cluster.

## What this skill does
Runs `helm lint`, `helm template`, and optional deep validation (kubeval schema check, helm-unittest) against a local chart directory.

## Steps

1. Ask: chart directory path, release name, values file(s) to use (optional)
2. Lint the chart:
   ```bash
   # Without a values file
   helm lint <chart-dir>/

   # With a values file
   helm lint <chart-dir>/ -f <values-file>
   ```
3. Render templates to stdout and check for YAML errors:
   ```bash
   # Without a values file
   helm template <release> <chart-dir>/

   # With a values file
   helm template <release> <chart-dir>/ -f <values-file>
   ```
4. If `kubeval` is available, pipe rendered output for schema validation:
   ```bash
   # Without a values file
   helm template <release> <chart-dir>/ | kubeval --strict

   # With a values file
   helm template <release> <chart-dir>/ -f <values-file> | kubeval --strict
   ```
5. If `helm-unittest` plugin is installed and `tests/` directory exists:
   ```bash
   helm unittest <chart-dir>/
   ```
6. Report all lint warnings, render errors, and schema violations

## Validation levels

| Tool | What it checks |
|---|---|
| `helm lint` | Chart structure, required fields, YAML syntax |
| `helm template` | Template rendering, missing values, type errors |
| `kubeval` | Kubernetes API schema conformance |
| `helm-unittest` | Unit tests for template logic |

## Stack
`helm lint` `helm template` `kubeval` `helm-unittest`

> 💡 **Model hint:** This is a mechanical validation task — a lightweight model (`gpt-4.1`) is sufficient.
