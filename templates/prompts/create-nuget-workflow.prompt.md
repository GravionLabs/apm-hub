---
agent: agent
tools: ['editFiles', 'search/codebase']
description: 'Create a GitHub Actions NuGet Package CI/CD workflow using GravionLabs/ci reusable workflows'
---

# Create NuGet Package CI/CD Workflow

Create a `.github/workflows/` file that calls the `GravionLabs/ci` reusable NuGet Package workflow.

## Step 1 — Gather information

Ask the user for the following. Do not assume defaults without asking.

- **Workflow file name** (e.g. `nuget-package.yml`). Default: `nuget-package.yml`.
- **Trigger branches**: Which branches should trigger CI? Default: `[main]` (push + pull_request).
- **NuGet publish feed type**: Where should the package be published?
  - `github` — GitHub Packages (`https://nuget.pkg.github.com/{owner}/index.json`)
  - `azure` — Azure Artifacts (`https://pkgs.dev.azure.com/{org}/_packaging/{feed}/nuget/v3/index.json`)
  - `jfrog` — JFrog Artifactory (`https://{domain}/artifactory/api/nuget/v3/{repo}`)
  - `nuget.org` — NuGet.org (`https://api.nuget.org/v3/index.json`)
- **Private restore feed?** (yes/no) — whether packages are restored from a private feed. Default: no.
- **GitVersion config file?** — path to a `GitVersion.yml` config (e.g. `GitVersion.yml`). Default: empty (use GitVersion defaults).
- **Verify package files?** (yes/no) — whether to verify specific files exist inside the `.nupkg`. Default: no.

Ask follow-up questions based on the answers:
- If **feed type is `github`**: ask for the GitHub `{owner}` (org or user).
- If **feed type is `azure`**: ask for `{org}`, `{feed}`.
- If **feed type is `jfrog`**: ask for `{domain}`, `{repo}`.
- If **private restore feed**: ask for `feed-url`, `feed-name` (default: `private-feed`), `feed-username`.
- If **verify package files**: ask for the newline-separated list of paths expected inside the `.nupkg`.

## Step 2 — Generate the workflow file

Create `.github/workflows/<workflow-file-name>` with the following structure.
Replace all `<placeholders>` with the values provided.

### Minimal workflow (no private feed, no verify):

```yaml
name: NuGet Package

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    uses: GravionLabs/ci/.github/workflows/nuget-package.yml@main
    with:
      publish-feed-url: <FEED_URL>
    secrets:
      publish-api-key: ${{ secrets.NUGET_API_KEY }}
```

### With private restore feed, GitVersion config, and package file verification:

```yaml
name: NuGet Package

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    uses: GravionLabs/ci/.github/workflows/nuget-package.yml@main
    with:
      publish-feed-url: <FEED_URL>
      gitversion-config-file: GitVersion.yml
      feed-url: <PRIVATE_RESTORE_FEED_URL>
      feed-name: <FEED_NAME>
      feed-username: <FEED_USERNAME>
      verify-package-files: |
        lib/net10.0/<ProjectName>.dll
        lib/net10.0/<ProjectName>.xml
        README.md
    secrets:
      publish-api-key: ${{ secrets.NUGET_API_KEY }}
      feed-token: ${{ secrets.NUGET_FEED_TOKEN }}
```

## Step 3 — Feed URL reference

Use these feed URL patterns based on the selected feed type:

| Feed | URL pattern |
|------|-------------|
| GitHub Packages | `https://nuget.pkg.github.com/{owner}/index.json` |
| Azure Artifacts | `https://pkgs.dev.azure.com/{org}/_packaging/{feed}/nuget/v3/index.json` |
| JFrog Artifactory | `https://{domain}/artifactory/api/nuget/v3/{repo}` |
| NuGet.org | `https://api.nuget.org/v3/index.json` |

## Step 4 — Required secrets

After creating the file, tell the user which repository secrets need to be configured:

- **`NUGET_API_KEY`** (always required) — API key or PAT for the publish feed:
  - GitHub Packages: a GitHub PAT with `write:packages` scope
  - Azure Artifacts: an Azure DevOps PAT with `Packaging (Read & Write)` scope
  - JFrog Artifactory: a JFrog API key
  - NuGet.org: an API key from [nuget.org/account/apikeys](https://www.nuget.org/account/apikeys)
- **`NUGET_FEED_TOKEN`** (only if private restore feed is enabled) — access token for the restore feed.

## Step 5 — Available optional inputs

Inform the user that the following inputs can be customized in the `with:` section if needed:

| Input | Default | Description |
|-------|---------|-------------|
| `dotnet-version` | `10.x` | .NET SDK version (e.g. `8.x`, `9.x`) |
| `dotnet-project` | `**/*.csproj` | Path to project file |
| `configuration` | `Release` | Build configuration |
| `coverage-format` | `cobertura` | Coverage format (`cobertura`, `opencover`, `lcov`, `json`) |
| `verbosity` | `minimal` | MSBuild verbosity |
| `force-publish` | `false` | Publish from any branch (not just `main`) |
| `nuget-config` | `nuget.config` | Path to `nuget.config` file |
