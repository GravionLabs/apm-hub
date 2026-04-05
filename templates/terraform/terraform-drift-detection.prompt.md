---
name: terraform-drift-detection
description: "Guided workflow to detect, assess, and remediate infrastructure drift in Terraform-managed environments."
mode: ask
tools: [codebase, runCommands, problems]
---

# Terraform Drift Detection & Remediation

Use this prompt when you suspect infrastructure has drifted from its Terraform configuration (e.g., after manual console changes, incident response, or auto-scaling events).

## Step 1 — Detect drift (read-only)

```bash
# Shows what changed in real infrastructure vs. state — does NOT modify anything
terraform plan -refresh-only
```

If the output is clean: no drift detected. If it shows changes: proceed.

## Step 2 — Identify affected resources

Review the plan output. For each changed resource:

```bash
terraform state show <resource_address>     # current state (pre-refresh)
```

Compare the state attributes against your `.tf` configuration to understand the scope of the change.

## Step 3 — Decide: accept drift or re-assert config?

**Option A — Re-assert Terraform config (overwrite manual changes):**
```bash
terraform plan                  # review what will change
terraform apply                 # apply the plan
```
Use this when the drift was an unwanted manual change.

**Option B — Accept drift (update state to match reality):**
```bash
terraform apply -refresh-only   # update state only, no resource changes
```
Use this when the change was intentional and the config needs to be updated separately.

**Option C — Re-import with updated config:**
```bash
# Remove from state and re-import with new resource address or updated config
terraform state rm <resource_address>
terraform import <resource_address> <provider_id>
```

## Step 4 — Import unmanaged resources (Terraform 1.5+)

For resources that exist in your cloud but aren't managed by Terraform:

```hcl
# Add to config (Terraform 1.5+)
import {
  to   = aws_s3_bucket.logs
  id   = "my-logs-bucket-name"
}
```

```bash
terraform plan     # generates resource config from the imported resource
terraform apply    # import and add to state
```

## Step 5 — Prevent future drift

Add to long-lived resources:

```hcl
lifecycle {
  prevent_destroy = true                           # protect from accidental destroy
  ignore_changes  = [tags["LastModified"]]         # ignore auto-managed attributes
}
```

Set up scheduled drift detection in CI:
```yaml
# Example GitHub Actions cron job
on:
  schedule:
    - cron: '0 6 * * 1'   # every Monday at 06:00

jobs:
  drift-check:
    steps:
      - run: terraform plan -refresh-only -detailed-exitcode
```
Exit code `2` = drift detected; `0` = clean.

## Checklist

- [ ] `terraform plan -refresh-only` run and output reviewed
- [ ] Decision made: accept or re-assert for each drifted resource
- [ ] State updated (`apply -refresh-only`) or config re-applied
- [ ] Unmanaged resources imported with `import {}` block or CLI
- [ ] `lifecycle.ignore_changes` set for auto-managed attributes
- [ ] Scheduled drift detection added to CI
