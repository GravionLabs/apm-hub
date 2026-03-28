---
agent: agent
description: 'Review a Helm values.yaml for completeness, security, naming conventions, and documentation quality'
---

# Review Helm values.yaml

Review the provided `values.yaml` (and optionally the chart templates) for completeness, security, maintainability, and usability.

## Review Focus

### 1. Completeness
- **Image configuration:** Is `image.repository`, `image.tag`, and `image.pullPolicy` present?
- **Resources:** Is a `resources: {}` block included (even if empty, to allow overrides)?
- **Service & port:** Is the service type and port configurable?
- **Ingress:** Is `ingress.enabled: false` present as a toggle for optional ingress?
- **Autoscaling:** Is `autoscaling.enabled: false` present?
- **ServiceAccount:** Is `serviceAccount.create: true` and `serviceAccount.annotations: {}` present?
- **Replica count:** Is `replicaCount` configurable?
- **Missing values:** Are there hardcoded values in templates that should be in `values.yaml`?

### 2. Security
- **Hardcoded secrets:** Flag any passwords, tokens, connection strings, or API keys in `values.yaml`.
- **Default passwords:** Flag default values for sensitive fields (e.g., `password: changeme`).
- **Security context:** Is `securityContext` or `podSecurityContext` included? Recommend non-root defaults.
- **Image tags:** Flag the use of `latest` or mutable tags as defaults — recommend SemVer pinning.
- **`imagePullPolicy`:** Should be `Always` for mutable tags; `IfNotPresent` for immutable.

### 3. Documentation
- **Comments:** Every top-level key should have a comment explaining its purpose.
- **Empty values:** Flag empty objects (`{}`) and arrays (`[]`) that aren't commented as intentional overrides.
- **Misleading defaults:** Flag defaults that don't reflect a working configuration.

### 4. Naming & Structure
- **Key naming:** All keys should be `camelCase`.
- **Grouping:** Values should be organized by resource/feature, not by parameter type.
- **Feature toggles:** Optional features should have an `enabled: true/false` key at the top level of their group.
- **Nesting:** Excessive nesting (>3 levels) makes override syntax unwieldy — flag where flattening helps.

### 5. Template Compatibility (if templates are provided)
- **Missing values:** Are there `.Values.x` references in templates with no corresponding key in `values.yaml`?
- **`required` usage:** Should any values use `required` instead of silently defaulting to empty?
- **Type mismatches:** Flag values used as a different type than declared (e.g., string used as int).

## Response Format

Return a prioritized, actionable checklist. For each issue:
1. **Key:** Which `values.yaml` key or template is affected?
2. **Description:** What is the issue?
3. **Recommendation:** How to fix it (with YAML example if helpful).
4. **Severity:** 🔴 High / 🟡 Medium / 🟢 Low

`values.yaml` to review:
${input:values:Paste the values.yaml content}
