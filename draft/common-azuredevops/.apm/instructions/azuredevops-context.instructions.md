---
applyTo: "**"
---

# Azure DevOps Context Resolution

When working with Azure DevOps tools, **always resolve the organization URL and project name automatically** from the current git repository's remote URL. Never ask the user which Azure DevOps organization or project to use.

## Resolution Algorithm

1. Run `git remote get-url origin` to obtain the remote URL.
2. Parse based on format:
   - **SSH**: `git@ssh.dev.azure.com:v3/<org>/<project>/<repo>` → org = `<org>`, project = `<project>`
   - **HTTPS**: `https://dev.azure.com/<org>/<project>/_git/<repo>` or `https://<org>@dev.azure.com/<org>/<project>/_git/<repo>`
3. Construct the organization URL as `https://dev.azure.com/<org>`.

## Rules

- **NEVER** prompt the user for the ADO organization URL or project name.
- **ALWAYS** derive them from `origin` remote before invoking any ADO tool.
- When delegating to sub-agents, **pass the resolved organization URL and project name explicitly** in your prompt so the sub-agent never needs to ask.
- Example prompt to sub-agent: *"ADO org: https://dev.azure.com/RWEST-MTI-AC, project: Generation and Operations — fetch work item 12345"*