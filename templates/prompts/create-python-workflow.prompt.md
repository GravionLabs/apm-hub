---
agent: agent
tools: ['editFiles', 'search/codebase']
description: 'Create a GitHub Actions Python Package CI/CD workflow using GravionLabs/ci reusable workflows'
---

# Create Python Package CI/CD Workflow

Create a `.github/workflows/` file that calls the `GravionLabs/ci` reusable Python Package workflow.

## Step 1 — Gather information

Ask the user for the following. Do not assume defaults without asking.

- **Workflow file name** (e.g. `python-package.yml`). Default: `python-package.yml`.
- **Trigger branches**: Which branches should trigger CI? Default: `[main]`.
- **Publish target**: Where should the package be published?
  - `pypi` — PyPI via **Trusted Publishing** (no API token needed; recommended for public packages)
  - `github` — GitHub Packages
  - `azure` — Azure Artifacts
  - `jfrog` — JFrog Artifactory
- **GitVersion config file?** — path to a `GitVersion.yml` config. Default: empty.
- **pytest extra args?** — additional pytest arguments (e.g. `tests/ -k "not slow"`). Default: empty.

Ask follow-up questions based on the answers:
- If **`github`**: ask for the GitHub `{owner}`.
- If **`azure`**: ask for `{org}`, `{feed}`.
- If **`jfrog`**: ask for `{domain}`, `{repo}`.
- If **NOT `pypi`**: ask for the secret name that holds the API token. Default: `PYPI_API_TOKEN`.

## Step 2 — Generate the workflow file

Create `.github/workflows/<workflow-file-name>`. Replace all `<placeholders>`.

### PyPI Trusted Publishing (recommended — no secret needed):

```yaml
name: Python Package

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    uses: GravionLabs/ci/.github/workflows/python-package.yml@main
    permissions:
      id-token: write   # required for PyPI Trusted Publishing
```

> **Note:** No `publish-feed-url` and no secret are needed for PyPI Trusted Publishing.
> Configure a Trusted Publisher on [pypi.org/manage/account/publishing/](https://pypi.org/manage/account/publishing/).

### Private feed:

```yaml
name: Python Package

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    uses: GravionLabs/ci/.github/workflows/python-package.yml@main
    with:
      publish-feed-url: <FEED_URL>
    secrets:
      publish-api-token: ${{ secrets.<SECRET_NAME> }}
```

### With GitVersion and custom pytest args:

```yaml
    with:
      publish-feed-url: <FEED_URL>
      gitversion-config-file: GitVersion.yml
      pytest-args: 'tests/ -v'
```

## Step 3 — Feed URL reference

| Feed | URL pattern |
|------|-------------|
| PyPI | (leave empty — Trusted Publishing) |
| GitHub Packages | `https://nuget.pkg.github.com/{owner}/` |
| Azure Artifacts | `https://pkgs.dev.azure.com/{org}/_packaging/{feed}/pypi/upload/` |
| JFrog Artifactory | `https://{domain}/artifactory/api/pypi/{repo}` |

## Step 4 — Required secrets & permissions

After creating the file, tell the user what needs to be configured:

- **PyPI Trusted Publishing** (no token): add a Trusted Publisher on pypi.org with the repository and workflow name.
- **Private feed**: create a repository secret (e.g. `PYPI_API_TOKEN`) with the API token for the feed.

## Step 5 — Available optional inputs

| Input | Default | Description |
|-------|---------|-------------|
| `python-version` | `3.14` | Python version to use |
| `uv-version` | (latest) | Pin `uv` version (e.g. `0.6.0`) |
| `working-directory` | `.` | Directory containing `pyproject.toml` |
| `coverage-report` | `xml` | Coverage format (`xml`, `html`, `term`, `term-missing`; empty to disable) |
| `force-publish` | `false` | Publish from any branch |
