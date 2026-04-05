---
name: multi-stage-dockerfile
description: 'Create an optimized multi-stage Dockerfile for any language or framework, minimizing final image size and following security best practices.'
allowed-tools: codebase editFiles
model: claude-sonnet-4.6
---

Create an optimized multi-stage Dockerfile for the project.

## What this skill does
Detects the project language/framework and creates a multi-stage Dockerfile that produces a minimal, secure production image.

## Stage pattern
```dockerfile
# Stage 1: build/restore dependencies (cache layer)
FROM <sdk-image> AS build
WORKDIR /app
COPY <dependency-files> .
RUN <install-dependencies>

# Stage 2: compile/bundle
COPY . .
RUN <build-command>

# Stage 3: runtime (minimal image)
FROM <runtime-image> AS final
WORKDIR /app
COPY --from=build /app/<output> .
USER nonroot
ENTRYPOINT [...]
```

## Per-language guidance

| Language | Build image | Runtime image |
|---|---|---|
| .NET | `mcr.microsoft.com/dotnet/sdk` | `mcr.microsoft.com/dotnet/aspnet` or `runtime` |
| Node.js | `node:<version>-alpine` | `node:<version>-alpine` |
| Python | `python:<version>-slim` | `python:<version>-slim` |
| Go | `golang:<version>-alpine` | `gcr.io/distroless/static` or `scratch` |

## Security rules
- Run as non-root user in the final stage: `USER nonroot` (or create a dedicated user)
- Do not copy `.git`, `node_modules`, secrets, or dev config into the image
- Add a `.dockerignore` file
- Pin base image versions — do not use `latest`

## Steps
1. Detect language and framework from project files
2. Write the Dockerfile with appropriate stages
3. Create or update `.dockerignore`

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
