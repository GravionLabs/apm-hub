---
agent: agent
description: 'Scaffold a reusable Terraform module with variables, outputs, examples, and terraform-docs README'
---

# Create Terraform Module

Scaffold a complete, reusable Terraform module following HashiCorp module development best practices.

## Module to Create

Module name: ${input:module_name:Enter the module name (e.g., vpc-network, rds-postgres)}
Cloud provider: ${input:provider:Enter the cloud provider (aws, azure, gcp, etc.)}
Purpose: ${input:purpose:Describe what this module provisions}

## Module Structure to Generate

```
modules/${module_name}/
├── main.tf           # resource definitions
├── variables.tf      # input variable declarations
├── outputs.tf        # output declarations
├── versions.tf       # required_providers and required_version
└── examples/
    └── basic/
        ├── main.tf   # minimal working example
        └── outputs.tf
```

## Requirements

### variables.tf
- Every variable must have `type` and `description`
- Constrained variables must have `validation {}` blocks
- Sensitive inputs must have `sensitive = true`
- Provide sensible `default` values where appropriate

### outputs.tf
- Every output must have `description`
- Sensitive outputs must have `sensitive = true`
- Export all values that consumers are likely to need (IDs, ARNs, endpoints)

### main.tf
- Apply standard tags: `Name`, `Environment`, `Project`, `ManagedBy = "terraform"`
- Use `var.environment` to differentiate resource names across environments
- Enable encryption at rest where applicable
- Apply least-privilege security group / IAM rules

### versions.tf

```hcl
terraform {
  required_version = ">= 1.6"
  required_providers {
    # pin with upper bound
  }
}
```

### examples/basic/main.tf
- Provide a minimal working example that demonstrates the module's core use case
- Use hardcoded values (no variables in examples) for clarity

## Naming Conventions

- Resource names: `snake_case` describing what they are (e.g., `aws_s3_bucket_artifacts`)
- Variable names: `snake_case`, descriptive (e.g., `vpc_cidr_block`)
- Output names: `snake_case`, resource-type prefixed where helpful (e.g., `bucket_arn`)

## After Generation

Suggest running:
```bash
# Format
terraform fmt -recursive modules/${module_name}/

# Validate example
cd modules/${module_name}/examples/basic
terraform init && terraform validate

# Generate README
terraform-docs markdown table modules/${module_name}/ > modules/${module_name}/README.md
```
