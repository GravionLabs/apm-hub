---
name: helm-chart-create
description: 'Scaffold a new Helm chart with Chart.yaml, values.yaml, named templates, standard Kubernetes resources, and security context defaults'
---

# Create Helm Chart

Scaffold a complete, production-ready Helm 3 chart following Helm best practices.

## Chart to Create

Chart name: ${input:chart_name:Enter the chart name (kebab-case, e.g., my-app)}
Application type: ${input:app_type:Describe the application (e.g., web API, background worker, cronjob)}
Container image: ${input:image:Enter the container image (e.g., ghcr.io/org/my-app)}

## Files to Generate

### `Chart.yaml`
```yaml
apiVersion: v2
name: ${chart_name}
description: A Helm chart for ${chart_name}
type: application
version: 0.1.0
appVersion: "1.0.0"
```

### `values.yaml`
Include defaults for:
- `replicaCount: 1`
- `image.repository`, `image.tag: ""`, `image.pullPolicy: IfNotPresent`
- `serviceAccount.create: true`, `serviceAccount.annotations: {}`
- `service.type: ClusterIP`, `service.port: 80`
- `ingress.enabled: false`
- `resources: {}`
- `autoscaling.enabled: false`
- `podAnnotations: {}`
- `podSecurityContext: {}`
- `securityContext: {}`
- `nodeSelector: {}`, `tolerations: []`, `affinity: {}`

### `templates/_helpers.tpl`
Define all standard helpers:
- `${chart_name}.name`
- `${chart_name}.fullname`
- `${chart_name}.chart`
- `${chart_name}.labels` (common labels)
- `${chart_name}.selectorLabels`
- `${chart_name}.serviceAccountName`

### `templates/deployment.yaml`
- Use `include` for all label references
- Include `securityContext` at pod and container level
- Include `resources` block from values
- Include `livenessProbe` and `readinessProbe` stubs (disabled by default)
- Add `checksum/config` annotation if ConfigMap is included

### `templates/service.yaml`
- ClusterIP by default; type configurable via `values.serviceType`

### `templates/serviceaccount.yaml`
- Wrapped in `{{- if .Values.serviceAccount.create }}`

### `templates/ingress.yaml`
- Wrapped in `{{- if .Values.ingress.enabled }}`
- Support `ingress.className`, `ingress.annotations`, `ingress.hosts`, `ingress.tls`

### `templates/hpa.yaml`
- Wrapped in `{{- if .Values.autoscaling.enabled }}`

### `templates/NOTES.txt`
- Show release URL after install
- Hint on how to get the application URL

### `.helmignore`
Standard Helm ignore patterns.

## Security Defaults

Apply secure-by-default container security context:
```yaml
securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  runAsNonRoot: true
  runAsUser: 1000
  capabilities:
    drop:
      - ALL
```

## After Generation

```bash
# Validate
helm lint ./${chart_name}

# Render locally
helm template test-release ./${chart_name}

# Dry-run install
helm install test-release ./${chart_name} --dry-run --debug
```
