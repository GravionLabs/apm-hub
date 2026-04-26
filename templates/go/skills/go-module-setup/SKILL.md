---
name: go-module-setup
description: 'Set up and manage Go modules: go.mod initialisation, go.work workspaces, vendor mode, module proxy, and dependency hygiene'
allowed-tools: execute shell runCommands read write edit editFiles search codebase
model: claude-sonnet-4.6
---

# Go Module Setup

Use this skill to initialise a module, configure a multi-module workspace, manage vendor mode, or resolve dependency issues.

## Stack
- **CLI:** `go mod` (key commands: `go mod init`, `go mod tidy`, `go mod vendor`, `go mod download`)
- **CLI:** `go work` (key commands: `go work init`, `go work use`, `go work sync`)
- **CLI:** `go list` (key commands: `go list -m all`, `go list -m -json all`)
- **Package manager:** Go modules (built-in)

## Module Initialisation

```bash
# Create a new module
go mod init github.com/org/repo

# Tidy after adding imports
go mod tidy

# Download all dependencies (useful in Docker for layer caching)
go mod download
```

`go.mod` declares the module path and minimum Go version. `go.sum` records expected cryptographic hashes — always commit both.

## Updating Dependencies

```bash
# Update all dependencies to their latest minor/patch
go get -u ./...
go mod tidy

# Update a specific dependency
go get github.com/some/package@latest

# Pin to a specific version
go get github.com/some/package@v1.2.3

# List all modules and versions
go list -m all
```

## Vendor Mode

```bash
# Create / refresh vendor directory
go mod vendor

# Build using only vendor (no network access)
go build -mod=vendor ./...

# Verify vendor contents are consistent with go.sum
go mod verify
```

Use vendor mode when:
- Network access is restricted at build time
- You want reproducible offline builds without a module cache

## Multi-Module Workspaces (`go.work`)

Workspaces let you develop multiple modules together without publishing intermediate versions.

```bash
# Initialise workspace at repo root
go work init

# Add a local module to the workspace
go work use ./services/api
go work use ./lib/shared

# Sync workspace with go.sum files
go work sync
```

The `go.work` file overrides `replace` directives in individual `go.mod` files. **Do not commit `go.work`** in most projects — add it to `.gitignore`. Commit `go.work.sum`.

```
# .gitignore
go.work
```

## Module Proxy & Private Modules

```bash
# Use the public proxy (default)
GOPROXY=https://proxy.golang.org,direct go mod download

# Direct access only (no proxy)
GOPROXY=direct go mod download

# Private modules (bypass proxy for your org)
GONOSUMDB=github.com/myorg/*
GOPRIVATE=github.com/myorg/*

# Authenticate to private GitHub modules
GOPRIVATE=github.com/myorg/* go get github.com/myorg/private-pkg@latest
```

## Diagnosing Module Issues

```bash
# Check why a dependency is included
go mod why github.com/some/package

# Find all versions available for a module
go list -m -versions github.com/some/package

# Check for available upgrades
go list -m -u all

# Visualise dependency graph
go mod graph | head -30
```

## Checklist

- [ ] `go.mod` has the correct module path (`module github.com/org/repo`)
- [ ] `go.mod` specifies the minimum Go version (`go 1.23`)
- [ ] `go.sum` is committed alongside `go.mod`
- [ ] `go mod tidy` has been run (no phantom imports or missing entries)
- [ ] `go.work` is in `.gitignore` (for single-release repos)
- [ ] Private modules configured via `GOPRIVATE` if applicable

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
