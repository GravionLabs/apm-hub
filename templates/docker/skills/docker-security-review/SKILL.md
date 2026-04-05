---
name: docker-security-review
description: 'Review a Dockerfile or docker-compose configuration for security issues: base image hygiene, running as root, exposed secrets, ADD vs COPY, .dockerignore, and image pinning.'
allowed-tools: codebase
model: claude-sonnet-4.6
---

Review Docker configuration for security vulnerabilities and best practice violations.

## Priority ratings
- 🔴 **Critical** — actively dangerous: running as root, secrets in image layers, no image pinning
- 🟡 **Important** — risk vectors: missing .dockerignore, ADD instead of COPY, no health check
- 🟢 **Suggestion** — hardening: distroless base, read-only filesystem, SBOM attestation

## Dockerfile checklist

### 🔴 Critical
- [ ] `USER` instruction present in final stage (not running as root)
- [ ] No secrets in `ENV`, `ARG`, or `RUN` commands — they persist in image layers
- [ ] Base image pinned to a specific version/digest — not `latest`
- [ ] No `ADD <url>` — use `curl` + checksum verification instead

### 🟡 Important
- [ ] `.dockerignore` exists and excludes `.git`, `node_modules`, `.env`, secrets
- [ ] `COPY` used instead of `ADD` for local files
- [ ] `apt-get` / `apk add` cleans up in same `RUN` layer (`rm -rf /var/lib/apt/lists/*`)
- [ ] No `--no-sandbox`, `--privileged`, or capability escalations
- [ ] Multi-stage build: final stage contains only runtime artifacts
- [ ] `HEALTHCHECK` instruction present

### 🟢 Suggestion
- [ ] Use distroless (`gcr.io/distroless/...`) or `scratch` for Go/Rust/compiled binaries
- [ ] Enable read-only root filesystem at runtime: `docker run --read-only`
- [ ] Pin base image by digest for fully reproducible builds: `FROM node:22@sha256:...`

## docker-compose checklist

### 🔴 Critical
- [ ] No plaintext secrets in `environment:` — use Docker secrets or external vault
- [ ] No unnecessary `privileged: true`

### 🟡 Important
- [ ] `healthcheck` defined for services with dependencies
- [ ] Resource limits set (`deploy.resources.limits.memory`)
- [ ] `/var/run/docker.sock` bind-mount only if required (grants root-equivalent access)

## Output format
Group by file. Priority emoji, line reference, issue, and suggested fix.

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
