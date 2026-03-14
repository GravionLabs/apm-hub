---
name: az-devops-setup
description: 'Guides the user through configuring az CLI and azure-devops extension for PR comments and pipeline integration'
---

> **IDE Compatibility:** ✅ Works in VS Code, JetBrains Copilot, and Copilot CLI.
>
> **Prerequisites:** [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)
> must be installed. Run `az --version` to verify.

# Azure DevOps Setup

Guide the user through setting up the `az` CLI with the `azure-devops` extension,
authenticating against their Azure DevOps organization, and verifying the connection.

## Step 1: Check Prerequisites

Run to verify existing installations:

```bash
az --version
az extension show --name azure-devops 2>/dev/null && echo "Extension installed" || echo "Extension missing"
```

## Step 2: Install azure-devops Extension

If the extension is not installed:

```bash
az extension add --name azure-devops
```

Verify:

```bash
az devops --version
```

## Step 3: Authenticate

```bash
# Interactive browser login (recommended for first-time setup)
az login

# For service principal / CI pipeline auth:
az login --service-principal \
  --username <app-id> \
  --password <password-or-cert> \
  --tenant <tenant-id>
```

## Step 4: Configure Default Organization and Project

Detect from git remote:

```bash
git remote get-url origin
```

Then configure defaults (replaces manual `--organization`/`--project` flags on every command):

```bash
az devops configure --defaults \
  organization=https://dev.azure.com/<YOUR-ORG> \
  project=<YOUR-PROJECT>
```

Verify:

```bash
az devops configure --list
```

## Step 5: Verify Connection

```bash
# List repositories in the configured project
az repos list --output table

# List recent PRs
az repos pr list --output table
```

If you see a list of repositories the connection is working correctly.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `az: command not found` | Azure CLI not installed | Install from [docs](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) |
| `Extension not installed` | azure-devops missing | `az extension add --name azure-devops` |
| `Please run az login` | Not authenticated | `az login` |
| `ResourceNotFound` | Wrong org/project | Check `az devops configure --list` |
| `TF401019` | Project not found | URL-encode spaces in project names |

## Personal Access Token (PAT) Alternative

For non-interactive environments (e.g., CI):

```bash
# Set PAT via environment variable
export AZURE_DEVOPS_EXT_PAT=<your-pat>

# Or pass inline
echo <your-pat> | az devops login --organization https://dev.azure.com/<YOUR-ORG>
```

Required PAT scopes: **Code (Read)**, **Pull Request Threads (Read & Write)**.

## Next Steps

Once configured, you can use the `@code-review-publisher` agent or
`/code-review-publisher` skill to post code review results directly to pull requests.
