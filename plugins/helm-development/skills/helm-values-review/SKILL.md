---
name: helm-values-review
description: 'Review a Helm values.yaml for completeness, security defaults, naming conventions, and documentation quality. Read-only — outputs findings only.'
allowed-tools: codebase
---

Review a Helm `values.yaml` for best practices.

## What this skill does
Evaluates a `values.yaml` (and optionally chart templates) for completeness, security, usability, and documentation. Does not modify files — outputs findings only.

## Priority ratings
- 🔴 **Critical** — security risks (root containers, privileged, no resource limits)
- 🟡 **Important** — missing required values, undocumented parameters, naming issues
- 🟢 **Suggestion** — structure improvements, additional flexibility

## Review checklist

### Security
- `podSecurityContext.runAsNonRoot: true` present and enabled by default
- `securityContext.allowPrivilegeEscalation: false` and `readOnlyRootFilesystem: true`
- No hardcoded secrets or credentials in `values.yaml`
- Image `pullPolicy` appropriate (avoid `Always` in production)

### Resource management
- `resources.requests` and `resources.limits` defined with sensible defaults
- `autoscaling` section present (even if disabled by default)

### Image configuration
- `image.repository`, `image.tag`, `image.pullPolicy` all configurable
- `image.tag` should default to `""` (chart uses `appVersion` as fallback)

### Documentation
- Every top-level key has a comment explaining its purpose
- Boolean flags have explicit `true`/`false` defaults

### Naming conventions
- camelCase for all keys
- Consistent structure: global settings at top, workload-specific below

## Output format
Group findings by section. Priority emoji, location, explanation, suggestion.
