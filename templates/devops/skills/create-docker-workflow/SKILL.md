---
name: "create-docker-workflow"
description: "Create a GitHub Actions workflow for building and pushing Docker images (multi-platform, OIDC auth, registry cache)"
allowed-tools: read write edit editFiles search codebase
model: gpt-4.1
---

# Create Docker Workflow

Use this skill to create a GitHub Actions workflow that builds and pushes a Docker image to a container registry.

## What this skill does

Creates `.github/workflows/docker.yml` with:
- Multi-platform builds (linux/amd64 + linux/arm64) via `docker/build-push-action`
- OIDC authentication to ECR / GHCR / ACR (no long-lived credentials)
- BuildKit layer caching via registry cache
- Image signing with `cosign` (optional)
- Tag strategy: branch name, PR number, semver tags, `latest`

## Steps

1. Ask: container registry (GHCR / ECR / ACR / Docker Hub), Dockerfile path, tag strategy, target platforms
2. Create `.github/workflows/docker.yml`:

```yaml
name: Docker Build & Push

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]

permissions:
  contents: read
  packages: write        # GHCR
  id-token: write        # OIDC (ECR/ACR)

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<SHA>

      - name: Set up QEMU (multi-platform)
        uses: docker/setup-qemu-action@<SHA>

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@<SHA>

      - name: Log in to registry
        uses: docker/login-action@<SHA>
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@<SHA>
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}

      - name: Build and push
        uses: docker/build-push-action@<SHA>
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=registry,ref=ghcr.io/${{ github.repository }}:buildcache
          cache-to: type=registry,ref=ghcr.io/${{ github.repository }}:buildcache,mode=max
```

3. Pin all action references to full commit SHAs
4. Adapt registry config for ECR (use `aws-actions/configure-aws-credentials` + OIDC) or ACR

## Constraints

- All action versions pinned to full commit SHA — never floating tags
- OIDC for cloud registry auth — never store registry credentials as secrets
- Builds run on PRs (push: false) for validation; push only on main/tags

> 💡 **Model hint:** This is a mechanical task — a fast model like `gpt-4.1` is sufficient. Use `/model` to switch.
