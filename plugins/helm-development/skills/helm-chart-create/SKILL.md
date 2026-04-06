---
name: helm-chart-create
description: 'Scaffold a new Helm 3 chart with Chart.yaml, values.yaml, named templates, standard Kubernetes resources, and security context defaults.'
allowed-tools: editFiles codebase runCommands
model: claude-sonnet-4.6
---

Scaffold a complete, production-ready Helm 3 chart.

## What this skill does
Creates a Helm chart with all required files, helper templates, and security-conscious defaults for a Kubernetes workload.

## Steps
1. Ask: chart name, application type (Deployment / StatefulSet / CronJob), container image, port, whether ingress is needed
2. Create chart structure:
   ```
   <chart-name>/
   ├── Chart.yaml
   ├── values.yaml
   ├── .helmignore
   └── templates/
       ├── _helpers.tpl
       ├── deployment.yaml (or statefulset.yaml)
       ├── service.yaml
       ├── ingress.yaml       (if requested)
       ├── serviceaccount.yaml
       ├── hpa.yaml           (disabled by default)
       └── NOTES.txt
   ```
3. `Chart.yaml`: set `apiVersion: v2`, `type: application`, `appVersion` from values
4. `values.yaml`: include `replicaCount`, `image`, `service`, `ingress`, `resources`, `autoscaling`, `podSecurityContext`, `securityContext`
5. `_helpers.tpl`: define `<chart>.fullname`, `<chart>.labels`, `<chart>.selectorLabels`
6. Set secure defaults: `runAsNonRoot: true`, `readOnlyRootFilesystem: true`, `allowPrivilegeEscalation: false`
7. Lint the chart: `helm lint <chart-name>/`

## Constraints
- Use `helm.sh/chart` label with chart name+version
- All image tags must be configurable via values — no hardcoded tags in templates
- Resources limits/requests must be configurable and have sensible defaults

## Stack
`helm` `kubectl` `helm lint` `helm template`

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
