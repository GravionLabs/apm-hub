---
name: terraform-plan-debugger
description: "Debug unexpected Terraform plan changes interactively. Guides you through diagnosing drift, provider mismatches, lifecycle issues, state inconsistencies, and missing moved{} blocks."
mode: ask
tools: [codebase, runCommands, problems]
---

# Terraform Plan Debugger

Use this prompt when `terraform plan` shows changes you didn't expect. Follow the steps to identify and fix the root cause.

## Step 1 — Capture the full plan output

```bash
terraform plan 2>&1 | tee /tmp/tf-plan.txt
```

Share the relevant section (resource type + diff) so we can identify the cause.

## Step 2 — Check for state drift first

```bash
# Show what changed outside Terraform (safest check — read only)
terraform plan -refresh-only

# If drift is found, options:
terraform refresh               # update state to match reality
# OR manually reconcile with terraform import / state commands
```

## Step 3 — Inspect provider versions

```bash
terraform providers               # list active providers and versions
cat .terraform.lock.hcl           # check pinned hashes
terraform providers lock \
  -platform=linux_amd64 \
  -platform=darwin_amd64 \
  -platform=windows_amd64         # re-lock for all platforms
```

Mismatch between local and CI provider versions is a common cause of unexpected diffs.

## Step 4 — Inspect state for the affected resource

```bash
terraform state list                          # all tracked resources
terraform state show <resource_address>       # detailed current state
```

Compare the state attributes against your `.tf` file. Differences indicate the cause.

## Step 5 — Check for missing `moved {}` blocks

If a resource was renamed or moved to a module, Terraform plans a destroy + create.

```hcl
# Add to main.tf or a dedicated moves.tf
moved {
  from = aws_instance.old_name
  to   = aws_instance.new_name
}
```

```bash
terraform plan          # should now show an in-place update instead
```

## Step 6 — Add `lifecycle` blocks for volatile attributes

If certain attributes change frequently but aren't meaningful (e.g., `tags`, `user_data`):

```hcl
resource "aws_instance" "app" {
  # ...
  lifecycle {
    ignore_changes = [tags["LastUpdated"], user_data]
    prevent_destroy = true    # for stateful resources in production
  }
}
```

## Step 7 — Verify workspace and var-file

```bash
terraform workspace show              # confirm correct workspace
terraform plan -var-file=env/prod.tfvars
```

## Step 8 — Validate and format

```bash
terraform validate
terraform fmt -recursive -check       # flag formatting issues
```

## Checklist

- [ ] Drift checked with `terraform plan -refresh-only`
- [ ] Provider versions pinned in `.terraform.lock.hcl`
- [ ] State inspected for affected resource
- [ ] `moved {}` block added if resource was renamed/moved
- [ ] `lifecycle.ignore_changes` set for volatile attributes
- [ ] Correct workspace + var-file active
- [ ] `terraform validate` passes
