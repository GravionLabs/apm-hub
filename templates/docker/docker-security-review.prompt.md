---
name: docker-security-review
description: "Guided Docker security review for Dockerfiles and docker-compose files. Steps through image hygiene, secrets exposure, privilege escalation, and hardening recommendations."
mode: ask
tools: [codebase, problems]
---

# Docker Security Review

Use this prompt to perform a security review of a Dockerfile or docker-compose configuration before pushing to a registry or deploying.

## Step 1 — Scan the base image

```bash
# Scan with Docker Scout (built-in, Docker Desktop + CLI)
docker scout cves <image>:<tag>
docker scout recommendations <image>:<tag>

# Or with Trivy (open source, CI-friendly)
trivy image <image>:<tag>
trivy fs --scanners vuln,secret,config .
```

Review: are there HIGH or CRITICAL CVEs in the base image? Consider switching to a newer or slimmer base.

## Step 2 — Check for secrets in image layers

```bash
# Scan filesystem for secrets
trivy fs --scanners secret .

# Inspect image history — verify no secrets leaked via RUN/ENV
docker history --no-trunc <image>
```

Rule: never use `ENV SECRET=value` or `ARG TOKEN=` with a default in Dockerfile. Secrets set this way are visible in `docker history`.

## Step 3 — Verify non-root execution

```bash
# Check which user the container runs as
docker run --rm <image> id
docker inspect <image> --format '{{.Config.User}}'
```

If empty or `root`, add `USER` to the Dockerfile final stage:
```dockerfile
RUN addgroup --system app && adduser --system --ingroup app app
USER app
```

## Step 4 — Review .dockerignore

```bash
cat .dockerignore
```

Should exclude at minimum:
```
.git
.env
*.env
node_modules
__pycache__
*.pyc
.DS_Store
secrets/
*.key
*.pem
```

## Step 5 — Review Dockerfile instructions

Look for:
- `ADD <url>` → replace with `curl` + `sha256sum` verification
- `RUN apt-get install` without `--no-install-recommends` and cleanup
- `COPY . .` without `.dockerignore` → risk of copying secrets

## Step 6 — Check docker-compose for privilege escalation

```yaml
# Dangerous — flag these:
privileged: true
user: root
volumes:
  - /var/run/docker.sock:/var/run/docker.sock   # grants root equivalent
```

## Step 7 — Enable hardening

```dockerfile
# Minimal Dockerfile hardening
FROM node:22-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --chown=app:app . .
USER app
HEALTHCHECK CMD wget -qO- http://localhost:3000/health || exit 1
```

## Checklist

- [ ] Base image scanned — no HIGH/CRITICAL CVEs
- [ ] No secrets in image layers (`docker history` clean)
- [ ] Container runs as non-root user
- [ ] `.dockerignore` excludes sensitive files
- [ ] No `ADD <url>` — using `curl` + checksum
- [ ] Package install layers cleaned up
- [ ] No `privileged: true` in compose
- [ ] `HEALTHCHECK` present
- [ ] Resource limits set in compose
