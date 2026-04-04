---
name: create-node-workflow
description: 'Create a GitHub Actions Node.js CI workflow using GravionLabs/ci reusable workflows'
allowed-tools: editFiles codebase
---

# Create Node.js CI Workflow

Create a `.github/workflows/` file that calls the `GravionLabs/ci` reusable Node.js CI workflow.

## Step 1 — Gather information

Ask the user for the following. Do not assume defaults without asking.

- **Workflow file name** (e.g. `node-ci.yml`). Default: `node-ci.yml`.
- **Trigger branches**: Which branches should trigger CI? Default: `[main]`.
- **Node.js version**: Which Node.js version to use. Default: `20`. Common choices: `18`, `20`, `22`.
- **Working directory**: Path to the Node.js project root. Default: `.` (repository root).
- **Run tests?** (yes/no): Whether to run `npm test`. Default: yes.

## Step 2 — Generate the workflow file

Create `.github/workflows/<workflow-file-name>`. Replace all `<placeholders>`.

### Minimal workflow (root directory, tests enabled):

```yaml
name: Node.js CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    uses: GravionLabs/ci/.github/workflows/node-ci.yml@main
```

### With custom Node version, working directory, and no tests:

```yaml
name: Node.js CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    uses: GravionLabs/ci/.github/workflows/node-ci.yml@main
    with:
      node-version: '22'
      working-directory: 'packages/my-app'
      run-tests: false
```

## Step 3 — Available optional inputs

After creating the file, inform the user of all available inputs:

| Input | Default | Description |
|-------|---------|-------------|
| `node-version` | `20` | Node.js version (e.g. `18`, `20`, `22`) |
| `working-directory` | `.` | Directory containing `package.json` |
| `run-tests` | `true` | Whether to run `npm test` |

## Step 4 — Prerequisites

Remind the user that the workflow runs `npm ci`, `npm run build --if-present`, and optionally `npm test --if-present`. The `package.json` should have the appropriate `build` and `test` scripts defined.
