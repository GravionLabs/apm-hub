---
name: az-devops-setup
description: 'Interactive setup guide for the az CLI azure-devops extension and authentication.'
allowed-tools: runCommands codebase
---

Set up the Azure DevOps CLI extension with authentication and default configuration.

## What this skill does
Installs the `azure-devops` CLI extension, authenticates, and configures the default organization and project.

## Steps
1. Verify `az` CLI: `az --version` (install from https://aka.ms/installazurecliwindows or `brew install azure-cli`)
2. Install extension: `az extension add --name azure-devops`
3. Authenticate: `az login` (browser) or `az devops login --token <PAT>`
4. Set defaults:
   ```bash
   az devops configure --defaults organization=https://dev.azure.com/<org> project=<project>
   ```
5. Verify: `az devops project show`
