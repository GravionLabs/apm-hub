---
description: Review .github/workflows/ci.yml against Horae project CI standards
---

Review `.github/workflows/ci.yml` for the Horae project against the GravionLabs/ci best practices and Horae-specific requirements.

## Checklist

### Reusable Workflow Interface

- [ ] Uses `GravionLabs/ci/.github/workflows/nuget-package.yml@main`
- [ ] Does **NOT** contain a `version:` input (versioning is internal)
- [ ] Does **NOT** have a separate `determine-version` job
- [ ] `dotnet-project` is set to `src/Horae/Horae.csproj`
- [ ] `gitversion-config-file` is set to `GitVersion.yml`
- [ ] `publish-feed-url` is `https://api.nuget.org/v3/index.json`
- [ ] `publish-api-key` maps to `${{ secrets.NUGET_API_KEY }}`

### Package Verification (`verify-package-files`)

The following paths must all be listed:

- [ ] `lib/net8.0/Horae.dll`
- [ ] `lib/net9.0/Horae.dll`
- [ ] `lib/net10.0/Horae.dll`
- [ ] `lib/net8.0/Horae.xml`
- [ ] `lib/net9.0/Horae.xml`
- [ ] `lib/net10.0/Horae.xml`
- [ ] `README.md`
- [ ] `CHANGELOG.md`

### Triggers

- [ ] Runs on `push` to `main`
- [ ] Runs on `pull_request`

### Repository Environment

- [ ] `nuget-publish` environment is configured in GitHub Settings → Environments
  (required by the reusable workflow's `publish` job)

## Response Format

For each failed check:

1. **Issue**: What is wrong or missing?
2. **Fix**: Corrected YAML snippet.
3. **Severity**: Critical / Warning / Info

Workflow to review:

${input:workflow:Paste the ci.yml content to review}
