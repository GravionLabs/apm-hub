---
agent: agent
tools: ['editFiles']
description: 'Create a GitHub Actions workflow that syncs docs to the GitHub Wiki using GravionLabs/ci reusable workflows'
---

# Create Wiki Sync Workflow

Create a `.github/workflows/sync-wiki.yml` file that calls the `GravionLabs/ci` reusable Wiki Sync workflow.

## Step 1 — Gather information

Ask the user for the following. Use the defaults shown if the user confirms or skips.

- **Docs path**: Path to the docs directory to sync. Default: `docs`.
- **README path**: Path to the README file that maps to the wiki Home page. Default: `README.md`.
- **Trigger branches**: Which branches should trigger the sync? Default: `[main]`.
- **Path filters**: Should the workflow only trigger when docs or README change? Default: yes (paths: `README.md`, `docs/**/*.md`).

## Step 2 — Prerequisites

Remind the user of the following before generating the file:

> ⚠️ **Wiki must be enabled** in the repository settings before this workflow can run.
> Go to **Settings → General → Features** and enable **Wikis**.
> The workflow will automatically initialize the wiki on first run if no pages exist yet.

## Step 3 — Generate the workflow file

Create `.github/workflows/sync-wiki.yml` with the following structure:

```yaml
name: Sync Wiki

on:
  push:
    branches: [<trigger-branches>]
    paths:
      - '<readme-path>'
      - '<docs-path>/**/*.md'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  sync-wiki:
    uses: GravionLabs/ci/.github/workflows/sync-wiki.yml@main
    secrets: inherit
```

If the user provided non-default `docs-path` or `readme-path`, add a `with:` block to the job:

```yaml
    with:
      docs-path: '<docs-path>'
      readme-path: '<readme-path>'
```

If the user does **not** want path filters, omit the `paths:` block from the trigger.

## Step 4 — Confirm

After creating the file, remind the user to:

1. Enable Wikis in repository settings if not already done.
2. Commit and push to trigger the workflow, or run it manually via `workflow_dispatch`.
3. The wiki will be auto-initialized on first run if it has never been used.
