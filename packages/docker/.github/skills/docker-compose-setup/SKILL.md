---
name: docker-compose-setup
description: 'Generate or review a docker-compose.yml for local development or testing: services, networking, volumes, health checks, environment variables, and resource limits.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase
model: claude-sonnet-4.6
---

Generate or review a `docker-compose.yml` configuration.

## Stack
- **CLI:** Docker Compose v2 (`docker compose up`, `docker compose down`, `docker compose logs`)
- **Format:** Compose Specification (no `version:` key required in Compose v2)

## Service structure

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: development          # or production
    image: myapp:dev
    ports:
      - "127.0.0.1:3000:3000"     # bind to localhost, not 0.0.0.0
    environment:
      NODE_ENV: development
    env_file:
      - .env.local                 # keep secrets out of compose file
    volumes:
      - .:/app:delegated           # source mount for hot reload
      - /app/node_modules          # anonymous volume prevents host override
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 10s
      timeout: 3s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 512m
          cpus: "0.5"
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: app
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d myapp"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  db-data:

networks:
  default:
    driver: bridge
```

## Key rules
- Use `depends_on.condition: service_healthy` — not just `depends_on: db`
- Bind ports to `127.0.0.1` for local dev — prevents unintended external exposure
- Named volumes for databases; avoid bind mounts for persistence in production
- Use `env_file` for secrets — never hardcode passwords in compose
- Omit `version:` key — deprecated in Compose Specification

## Common compose commands

```bash
docker compose up -d              # start all services in background
docker compose down --volumes     # stop and remove volumes
docker compose logs -f app        # stream logs for a service
docker compose exec app sh        # open shell in running service
docker compose build --no-cache   # force rebuild
docker compose ps                 # show running services
```

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
