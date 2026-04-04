---
description: 'Helm chart conventions: chart structure, values.yaml design, named templates, helpers, versioning, and Kubernetes packaging best practices'
applyTo: '**/Chart.yaml,**/values.yaml,**/values*.yaml,**/templates/**/*.yaml,**/templates/**/*.tpl,**/_helpers.tpl'
---

# Helm Chart Conventions

## Chart Structure

```
<chart-name>/
├── Chart.yaml            # chart metadata (name, version, appVersion, dependencies)
├── values.yaml           # default configuration values
├── values-dev.yaml       # environment-specific overrides (if used)
├── .helmignore           # files to exclude from the chart package
├── templates/
│   ├── _helpers.tpl      # named template definitions (no output)
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── serviceaccount.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── hpa.yaml
│   ├── NOTES.txt         # post-install instructions
│   └── tests/
│       └── test-connection.yaml
└── charts/               # sub-charts / dependencies (managed by helm dependency update)
```

## Chart.yaml

- Set `apiVersion: v2` for Helm 3 charts.
- `version`: the chart version (SemVer, incremented on chart changes).
- `appVersion`: the application version being packaged (not the chart version).
- `type: application` for deployable charts; `type: library` for shared template charts.
- Include `description`, `maintainers`, `home`, and `sources` where applicable.

```yaml
apiVersion: v2
name: my-app
description: A Helm chart for My Application
type: application
version: 1.2.0
appVersion: "3.5.1"
```

## values.yaml Design

- Organize values by resource type, not by parameter type.
- Use `camelCase` for value keys.
- Every top-level key should have a comment describing its purpose.
- Provide sensible defaults that work out-of-the-box.
- Group image settings: `image.repository`, `image.tag`, `image.pullPolicy`.
- Use `{}` or `[]` as defaults for objects and arrays that consumers may override.

```yaml
# Number of replicas for the Deployment
replicaCount: 1

image:
  repository: ghcr.io/org/my-app
  pullPolicy: IfNotPresent
  # Overrides the image tag whose default is the chart appVersion
  tag: ""

serviceAccount:
  create: true
  annotations: {}
  name: ""

resources: {}

autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80
```

## Named Templates (_helpers.tpl)

- Define all reusable label and name helpers in `_helpers.tpl`.
- Always include the standard label set on all resources.
- Use `include` over `template` for composable templates.

```yaml
{{/*
Expand the name of the chart.
*/}}
{{- define "my-app.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "my-app.labels" -}}
helm.sh/chart: {{ include "my-app.chart" . }}
{{ include "my-app.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}
```

## Template Best Practices

- Use **`include`** (not `template`) for named template invocations to allow piping.
- Always quote string values that might be interpreted as non-strings: `{{ .Values.someString | quote }}`.
- Use `{{- ... -}}` to control whitespace; avoid blank lines in output.
- Wrap optional resources (Ingress, HPA, ServiceAccount) in `{{- if .Values.feature.enabled }}`.
- Use `toYaml | nindent N` for multi-line values (resources, env, volumeMounts).
- Use `required` for mandatory values without defaults:
  ```yaml
  {{ required "A valid .Values.host is required" .Values.host }}
  ```

## Security

- Set `securityContext` on both Pod and Container levels.
- Run as non-root: `runAsNonRoot: true`, `runAsUser: 1000`.
- Set `allowPrivilegeEscalation: false`.
- Use `readOnlyRootFilesystem: true` where possible.
- Never hardcode secrets — use `Secret` references with `secretKeyRef`.
- Use `imagePullPolicy: Always` for mutable tags (e.g., `latest`).

## Versioning

- **Chart version** (`version` in `Chart.yaml`): increment on every chart change (SemVer).
- **App version** (`appVersion`): reflect the application release being packaged.
- Use **OCI registry** (`helm push`) for chart distribution where possible.
- Tag chart releases in Git: `<chart-name>-<version>` (e.g., `my-app-1.2.0`).
