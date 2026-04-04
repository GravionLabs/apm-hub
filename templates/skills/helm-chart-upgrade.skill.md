---
name: helm-chart-upgrade
description: 'Upgrade a Helm chart to a newer chart or app version: update Chart.yaml, migrate deprecated Kubernetes APIs, and handle values.yaml breaking changes.'
allowed-tools: editFiles codebase runCommands
---

Upgrade a Helm chart to a newer version.

## What this skill does
Analyzes the current chart version, identifies required changes (Kubernetes API deprecations, values schema changes), applies updates, and verifies the chart lints cleanly.

## Steps

### Phase 1 — Assess
1. Read `Chart.yaml` for current `apiVersion`, `version`, and `appVersion`
2. Read `values.yaml` and all templates to understand current structure
3. Identify the target version (ask if not specified — chart version, app version, or Kubernetes API version)

### Phase 2 — Identify changes
4. Check for deprecated Kubernetes API versions in templates:
   - `extensions/v1beta1` → `apps/v1` (Deployment, DaemonSet, ReplicaSet)
   - `networking.k8s.io/v1beta1` → `networking.k8s.io/v1` (Ingress)
   - `policy/v1beta1` → `policy/v1` (PodDisruptionBudget)
5. Check for breaking changes in upstream Helm chart if this is a dependency

### Phase 3 — Apply changes
6. Update `Chart.yaml`: bump `version` (SemVer), update `appVersion`
7. Replace deprecated API versions in templates
8. Update `values.yaml` for any breaking value renames or restructuring
9. Update `Chart.lock` if dependencies changed: `helm dependency update`

### Phase 4 — Verify
10. `helm lint <chart-dir>/`
11. `helm template <chart-dir>/` to validate rendering

## Constraints
- Never downgrade `apiVersion` — always upgrade to supported versions
- Document breaking value changes in `NOTES.txt` or chart README
