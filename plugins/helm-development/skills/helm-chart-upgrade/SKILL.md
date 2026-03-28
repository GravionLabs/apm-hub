---
name: helm-chart-upgrade
description: 'Upgrade a Helm chart to a newer chart API version, update deprecated Kubernetes APIs, and migrate values.yaml breaking changes'
---

# Upgrade Helm Chart

Analyze the provided Helm chart and produce an upgrade plan with all required changes.

## Chart to Upgrade

Current chart version: ${input:current_version:Enter the current chart version (e.g., 1.x)}
Target chart version or Helm API version: ${input:target_version:Enter the target version or describe the upgrade goal}

Paste the chart contents below or describe what needs upgrading:
${input:chart_content:Paste Chart.yaml, values.yaml, or specific templates to review}

## Upgrade Analysis

Analyze the chart for:

### 1. Chart API Version (`apiVersion`)
- If `apiVersion: v1` → upgrade to `apiVersion: v2` (Helm 3 only).
- Helm 2 charts (`v1`) do not support `type`, `dependencies` in `Chart.yaml`, or library charts.
- Migration: update `Chart.yaml`, move any `requirements.yaml` dependencies into `Chart.yaml`.

### 2. Deprecated Kubernetes API Versions
Check for deprecated or removed APIs based on the target Kubernetes version:

| Deprecated API | Replacement | Removed in |
|:---------------|:------------|:-----------|
| `extensions/v1beta1 Ingress` | `networking.k8s.io/v1 Ingress` | K8s 1.22 |
| `extensions/v1beta1 Deployment` | `apps/v1 Deployment` | K8s 1.16 |
| `policy/v1beta1 PodDisruptionBudget` | `policy/v1 PodDisruptionBudget` | K8s 1.25 |
| `policy/v1beta1 PodSecurityPolicy` | Removed — use OPA/Kyverno | K8s 1.25 |
| `networking.k8s.io/v1beta1 IngressClass` | `networking.k8s.io/v1 IngressClass` | K8s 1.22 |
| `autoscaling/v2beta2 HPA` | `autoscaling/v2 HPA` | K8s 1.26 |
| `batch/v1beta1 CronJob` | `batch/v1 CronJob` | K8s 1.25 |

### 3. Breaking values.yaml Changes
- Identify any value renames or restructures between chart versions.
- List old key → new key migrations.
- Flag deprecated values that will be removed.
- Provide a migration guide for consumers of the chart.

### 4. Named Template Renames
- List any `_helpers.tpl` template renames that would break overrides.
- Check for `define` blocks that users may be overriding.

### 5. Security Context Upgrades
- If `PodSecurityPolicy` was used → migrate to `securityContext` + admission controller (OPA/Kyverno/PSA).
- Add `seccompProfile: RuntimeDefault` if missing (recommended K8s 1.19+).
- Add `capabilities.drop: [ALL]` if missing.

## Output Format

1. **Breaking changes summary** — what must be updated before upgrading.
2. **values.yaml migration guide** — old → new key table with examples.
3. **Template changes** — specific file/line changes needed.
4. **Kubernetes API updates** — replace deprecated `apiVersion` strings.
5. **Upgrade commands:**
```bash
# Update chart dependencies
helm dependency update ./<chart>

# Validate after changes
helm lint ./<chart>
helm template test-release ./<chart> -f values-upgraded.yaml

# Install or upgrade
helm upgrade my-release ./<chart> -f values-upgraded.yaml
```
