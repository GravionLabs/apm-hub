---
name: terraform-code-review
description: 'Perform a structured Terraform code review with priority ratings: 🔴 critical security/state risks, 🟡 important improvements, 🟢 best practice suggestions.'
allowed-tools: codebase
model: claude-sonnet-4.6
---

Review Terraform configuration for security, correctness, and best practices.

## What this skill does
Provides a structured, prioritized review of Terraform code. Does not modify files — outputs findings only.

## Priority ratings
- 🔴 **Critical** — security vulnerabilities, state corruption risk, exposed secrets
- 🟡 **Important** — missing variable validation, hardcoded values, non-idiomatic structure
- 🟢 **Suggestion** — naming, formatting, documentation improvements

## Review checklist

### Security
- No secrets or credentials in `.tf` files or `terraform.tfvars`
- Sensitive variables marked with `sensitive = true`
- IAM policies follow least privilege — no wildcard `*` actions/resources unless justified
- Security groups: no `0.0.0.0/0` ingress unless required and documented
- S3 buckets: `block_public_acls`, `block_public_policy` enabled

### State management
- Remote state configured with locking (S3 + DynamoDB, or Terraform Cloud)
- No local state files committed to version control
- Outputs for cross-module references — not hardcoded ARNs/IDs

### Module design
- Variables have `description` and appropriate `type` constraints
- Variables have `validation` blocks for constrained inputs
- Outputs have `description` attributes
- Module sources pinned to a specific version/tag

### Naming
- Resources: `<provider>_<type>_<purpose>` (snake_case)
- Consistent naming across resources, variables, outputs

### Formatting
- Code formatted with `terraform fmt`; flag any unformatted blocks

## Output format
Group by file. Priority emoji, location, explanation, suggested fix.

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
