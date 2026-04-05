---
name: Create Docker Workflow
description: Create a GitHub Actions workflow for building and pushing Docker images with multi-platform support, OIDC auth, and registry caching
mode: agent
tools: ["editFiles", "codebase"]
---

# Create Docker Workflow

Generate a production-ready GitHub Actions workflow for Docker builds.

## Step 1: Gather Requirements

Ask the user:
1. **Container registry**: GHCR (default) / Amazon ECR / Azure ACR / Docker Hub
2. **Image name**: e.g., `myorg/myapp` or `ghcr.io/${{ github.repository }}`
3. **Dockerfile path**: `./Dockerfile` (default) or custom path
4. **Platforms**: `linux/amd64` only (fast) or `linux/amd64,linux/arm64` (multi-platform)
5. **Tag strategy**: semver tags only / also push on main / custom
6. **Image signing**: cosign (yes/no)

## Step 2: Select Auth Pattern

### GHCR (GitHub Container Registry)
```yaml
- uses: docker/login-action@<SHA>
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}
```

### Amazon ECR (OIDC — no keys)
```yaml
permissions:
  id-token: write
  contents: read

- uses: aws-actions/configure-aws-credentials@<SHA>
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
    aws-region: eu-west-1

- id: login-ecr
  uses: aws-actions/amazon-ecr-login@<SHA>
```

### Azure ACR (OIDC)
```yaml
permissions:
  id-token: write

- uses: azure/login@<SHA>
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

- run: az acr login --name myregistry
```

## Step 3: Create Workflow File

Create `.github/workflows/docker.yml` with:

```yaml
name: Docker Build & Push

on:
  push:
    branches: [main]
    tags: ['v*.*.*']
  pull_request:
    branches: [main]

permissions:
  contents: read
  packages: write
  id-token: write  # Only if using OIDC

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<SHA>

      - name: Set up QEMU
        uses: docker/setup-qemu-action@<SHA>

      - name: Set up Buildx
        uses: docker/setup-buildx-action@<SHA>

      - name: Log in to registry
        uses: docker/login-action@<SHA>
        with: # ... per registry above

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@<SHA>
        with:
          images: <IMAGE_NAME>
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push
        uses: docker/build-push-action@<SHA>
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=registry,ref=<IMAGE_NAME>:buildcache
          cache-to: type=registry,ref=<IMAGE_NAME>:buildcache,mode=max
```

## Step 4: Pin Action SHAs

Look up current SHAs for all actions used:
- `actions/checkout`
- `docker/setup-qemu-action`
- `docker/setup-buildx-action`
- `docker/login-action`
- `docker/metadata-action`
- `docker/build-push-action`

Replace `@<SHA>` placeholders with actual full commit SHAs.

## Constraints

- Never use floating tags (`@v3`, `@latest`) — pin to full commit SHA
- OIDC for cloud registries — no stored credentials
- Builds validate on PRs; push only on merge to main or semver tags
