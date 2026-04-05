---
name: terraform-drift-detection
description: 'Detect and remediate infrastructure drift: resources modified outside Terraform that are no longer consistent with state or configuration.'
allowed-tools: codebase runCommands
---

Detect and remediate Terraform drift — resources that changed outside Terraform.

## Stack
- **CLI:** Terraform (`terraform plan`, `terraform refresh`, `terraform state`, `terraform import`)
- **Optional:** `driftctl` for cross-account drift scanning

## What is drift?
Drift occurs when the real infrastructure no longer matches what Terraform expects: manual console changes, CLI edits, auto-scaling events, or external automation.

## Detect drift

```bash
# Safe read-only check — shows what changed without modifying state
terraform plan -refresh-only

# Update state to match current reality (no resource changes)
terraform apply -refresh-only
```

## Inspect drifted resources

```bash
terraform state list                         # all tracked resources
terraform state show <resource_address>      # current state attributes
```

## Remediation options

| Approach | When to use |
|---|---|
| `terraform apply` | Re-assert Terraform config over drifted resource |
| `terraform apply -refresh-only` | Accept drift — update state to match reality |
| `terraform state rm` + `terraform import` | Re-import resource with updated config |
| `terraform state rm` | Remove orphaned resource that no longer exists |

## Import existing resources into state

```bash
# Bring an unmanaged resource under Terraform control
terraform import <resource_address> <provider_id>

# Example: import existing S3 bucket
terraform import aws_s3_bucket.logs my-logs-bucket-name
```

Terraform 1.5+ supports `import {}` blocks in config:
```hcl
import {
  to = aws_s3_bucket.logs
  id = "my-logs-bucket-name"
}
```

## Prevent future drift

- Enable `prevent_destroy = true` on critical resources
- Use `lifecycle { ignore_changes = [...] }` for auto-managed attributes (e.g., ASG `desired_capacity`)
- Run `terraform plan -refresh-only` in CI on a schedule to detect drift early
- Use Terraform Cloud / Atlantis drift detection features
