---
name: terraform-plan-debugger
description: 'Diagnose unexpected Terraform plan changes: drift, missing lifecycle blocks, provider mismatches, state inconsistencies, incorrect variable values, and missing moved{} blocks.'
allowed-tools: codebase runCommands
---

Diagnose why a Terraform plan shows unexpected changes.

## Stack
- **CLI:** Terraform (`terraform plan`, `terraform state`, `terraform refresh`, `terraform providers`)
- **Optional:** `tfsec`, `checkov` for secondary validation

## Common causes of unexpected plan changes

### 1 — State drift (infrastructure changed outside Terraform)
Resources modified manually (console, CLI, other tools).
```bash
terraform plan -refresh-only        # show what drifted
terraform refresh                   # update state to match reality (careful!)
terraform state show <resource>     # inspect specific resource state
```

### 2 — Missing `lifecycle` blocks
Resource is recreated when it should be updated in-place.
```hcl
lifecycle {
  ignore_changes = [tags, user_data]   # ignore non-critical attribute changes
  prevent_destroy = true               # protect stateful resources
}
```

### 3 — Provider version mismatch
Different team members / CI using different provider versions.
```bash
terraform providers lock -platform=linux_amd64 -platform=darwin_amd64
cat .terraform.lock.hcl              # check pinned hashes
terraform init -upgrade              # upgrade to latest allowed version
```

### 4 — State inconsistencies
Resource exists in state but not in config, or vice versa.
```bash
terraform state list                 # all resources in state
terraform state show <resource>      # detailed resource attributes
terraform state rm <resource>        # remove orphaned resource from state
```

### 5 — Missing `moved {}` blocks (refactoring)
Renamed or moved resources appear as destroy + create.
```hcl
moved {
  from = aws_instance.old_name
  to   = aws_instance.new_name
}
```

### 6 — Incorrect variable values
Plan uses wrong workspace/var-file.
```bash
terraform plan -var-file=env/prod.tfvars
terraform workspace show             # confirm active workspace
```

## Diagnostic checklist
- [ ] Run `terraform plan -refresh-only` — is drift the cause?
- [ ] Check `.terraform.lock.hcl` — are provider versions pinned?
- [ ] Check if resource was renamed/moved — add `moved {}` block
- [ ] Check `lifecycle.ignore_changes` for volatile attributes
- [ ] Confirm correct workspace and var-file are active

## Output format
Report the most likely cause first, with the exact command or config change to resolve it.
