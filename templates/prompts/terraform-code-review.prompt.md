---
agent: agent
description: 'Review a Terraform configuration for security, naming conventions, module design, state management, and IaC best practices'
---

# Terraform Code Review

Review the provided Terraform configuration for correctness, security, maintainability, and adherence to HashiCorp best practices.

## Review Focus

### 1. Security
- **Least privilege:** Are IAM roles, security groups, and network ACLs scoped to minimum required access? Flag overly permissive policies (`*` actions, `0.0.0.0/0` ingress).
- **Secrets in code:** Flag any hardcoded credentials, tokens, passwords, or sensitive values not marked `sensitive = true`.
- **Encryption:** Check that storage resources (S3, EBS, RDS, Azure Blob, GCS) have encryption enabled.
- **Public exposure:** Flag resources unintentionally exposed to the internet (S3 `acl = "public-read"`, open security groups).
- **Deletion protection:** Flag stateful resources in production missing `prevent_destroy = true`.

### 2. State Management
- **Remote backend:** Flag local state (`terraform { backend "local" }`).
- **State locking:** Verify locking is enabled (DynamoDB for S3 backend, built-in for Terraform Cloud).
- **Sensitive outputs:** Flag outputs that expose secrets without `sensitive = true`.

### 3. Provider & Version Constraints
- **Pinned versions:** Flag providers without upper-bound version constraints in production.
- **`required_version`:** Verify Terraform CLI version is constrained in `terraform {}` block.

### 4. Code Quality
- **DRY:** Flag repeated resource blocks that should use `for_each` or a module.
- **Naming:** Check resources, variables, outputs follow `snake_case` and are descriptive.
- **Variable descriptions:** Flag variables missing `description` or `type`.
- **`for_each` vs `count`:** Flag `count` usage for resources where removal from the middle would cause destructive plan diffs.
- **`moved {}` blocks:** Flag refactored resources that are missing `moved {}` to avoid destroy/recreate.
- **Comments:** Flag comments that describe *what*, not *why*.

### 5. Module Design (if reviewing a module)
- **Input/output contracts:** All variables and outputs must have `description`.
- **`sensitive` variables:** Sensitive inputs marked with `sensitive = true`.
- **Examples:** Does the module have a working example in `examples/`?
- **README:** Is README auto-generated with `terraform-docs`?

### 6. Formatting & Validation
- Flag code not passing `terraform fmt -check`.
- Flag configurations that would fail `terraform validate`.

## Response Format

Return a prioritized, actionable checklist. For each issue:
1. **File & resource:** Where is the issue?
2. **Description:** What is the issue?
3. **Rule:** Which Terraform/security rule is violated?
4. **Recommendation:** How to fix it (with HCL example if helpful).
5. **Severity:** 🔴 High / 🟡 Medium / 🟢 Low

Terraform configuration to review:
${input:code:Paste the Terraform configuration or diff to review}
