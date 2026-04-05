---
name: docker-compose-setup
description: "Interactive guide to create or fix a docker-compose.yml: services, networking, health checks, secrets, volumes, and resource limits."
mode: ask
tools: [codebase, editFiles, runCommands]
---

# Docker Compose Setup

Use this prompt to create a new `docker-compose.yml` or review and improve an existing one.

## Step 1 — Understand the project

Answer these questions before starting:
- What services does the application need? (app, database, cache, queue, reverse proxy?)
- Is this for local development, CI, or production?
- Which ports need to be exposed externally?
- Where does persistent data live? (database, uploads, etc.)

## Step 2 — Create the compose file structure

```bash
# Check existing compose files
ls docker-compose*.yml compose*.yml 2>/dev/null
```

Use the Compose Specification format (no `version:` key required):

```yaml
services:
  app:
    build: .
    ports:
      - "127.0.0.1:3000:3000"
    depends_on:
      db:
        condition: service_healthy
    env_file: .env.local
    volumes:
      - .:/app
      - /app/node_modules
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 10s
      retries: 3

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: app
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      retries: 5

volumes:
  db-data:
```

## Step 3 — Separate dev and prod config

```bash
# docker-compose.yml — base config (shared)
# docker-compose.override.yml — dev overrides (auto-loaded)
# docker-compose.prod.yml — production overrides

# Apply prod config:
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Step 4 — Handle secrets safely

```bash
# Create .env.local (not committed to git)
echo "DB_PASSWORD=secret123" > .env.local
echo ".env.local" >> .gitignore
```

In compose:
```yaml
env_file:
  - .env.local        # loaded from file, not hardcoded
```

## Step 5 — Add health checks and dependencies

All services that other services depend on must have `healthcheck`:

```yaml
depends_on:
  db:
    condition: service_healthy   # waits for healthy, not just started
  redis:
    condition: service_healthy
```

## Step 6 — Validate and start

```bash
docker compose config               # validate compose file
docker compose up -d                # start all services
docker compose ps                   # check status
docker compose logs -f              # stream all logs

# Verify health checks
docker compose ps | grep healthy
```

## Step 7 — Resource limits (production)

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 512m
          cpus: "0.5"
        reservations:
          memory: 256m
```

## Checklist

- [ ] All services defined with `healthcheck`
- [ ] `depends_on` uses `condition: service_healthy`
- [ ] No secrets hardcoded — using `env_file` or Docker secrets
- [ ] Ports bound to `127.0.0.1` for local dev
- [ ] Named volumes for persistent data
- [ ] Dev overrides in `docker-compose.override.yml`
- [ ] Resource limits set for production
- [ ] `docker compose config` validates without errors
