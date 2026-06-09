---
name: py-uv-cli
description: >
  Provide a curated reference of uv CLI flags for Python development workflows.
  Use this skill when you need the correct uv command flags for running commands,
  managing dependencies, syncing environments, or configuring CI pipelines — even
  if the user only mentions "uv", "venv", or "dependencies" without naming specific flags.
allowed-tools: read search codebase
compatibility: opencode, github-copilot
---

## Overview

Curated reference for uv CLI. Load when choosing uv flags for any
Python development task.

## `uv run` — Run command in project environment

```powershell
uv run [OPTIONS] <COMMAND> [ARGS]
```

| Flag             | Effect                                           | When to use                        |
|------------------|--------------------------------------------------|------------------------------------|
| *(none)*         | Sync env + update lockfile check before running  | First run / unknown env state      |
| `--frozen`       | Skip lockfile update; use `uv.lock` as-is        | Repeated dev runs (faster)         |
| `--no-sync`      | Skip env sync entirely (implies `--frozen`)      | Fastest; env is already up-to-date |
| `--locked`       | Assert `uv.lock` is unchanged; fail if not       | CI pipelines — catch drift early   |
| `-q` / `--quiet` | Suppress uv progress output (not the subprocess) | Scripted runs, clean task output   |
| `--no-progress`  | Hide spinners/progress bars                      | Non-interactive environments       |

**Decision: dev vs. CI**
```
Is the environment freshly provisioned (CI)?
├─ Yes → use --locked  (asserts lockfile is correct)
└─ No  → Is the env definitely up-to-date?
         ├─ Yes → use --no-sync  (skip sync entirely)
         └─ No  → use --frozen  (skip lockfile update, sync if needed)
```

## `uv add` — Add dependencies

```powershell
uv add [OPTIONS] <PACKAGE>
```

| Flag                | Effect                                                                       |
|---------------------|------------------------------------------------------------------------------|
| `--dev`             | Add to `[dependency-groups] dev` (preferred over `--optional` for dev tools) |
| `--group <name>`    | Add to a named dependency group                                              |
| `--optional <name>` | Add to `[project.optional-dependencies]` (use for published extras)          |
| `--frozen`          | Do not update `uv.lock` (add to `pyproject.toml` only)                       |

## `uv sync` — Install dependencies from lockfile

```powershell
uv sync [OPTIONS]
```

| Flag                   | Effect                                                  |
|------------------------|---------------------------------------------------------|
| *(none)*               | Sync all groups including dev                           |
| `--frozen`             | Use `uv.lock` as-is, do not check for updates           |
| `--locked`             | Assert `uv.lock` unchanged; fail if drift detected (CI) |
| `--no-dev`             | Exclude dev dependencies (production install)           |
| `--group <name>`       | Include a specific dependency group                     |
| `--no-install-project` | Skip installing the project itself (install deps only)  |

## `uv lock` — Manage lockfile

```powershell
uv lock [OPTIONS]
```

| Flag                      | Effect                                                        |
|---------------------------|---------------------------------------------------------------|
| *(none)*                  | Resolve and write `uv.lock`                                   |
| `--upgrade`               | Re-resolve all packages to latest compatible versions         |
| `--upgrade-package <pkg>` | Upgrade only a specific package                               |
| `--check`                 | Exit non-zero if lockfile is out of date (CI-safe, no writes) |

## Key environment variables

| Variable           | Equivalent flag | Notes                                                       |
|--------------------|-----------------|-------------------------------------------------------------|
| `UV_FROZEN=1`      | `--frozen`      | Apply globally to all uv commands in a shell session        |
| `UV_NO_SYNC=1`     | `--no-sync`     | Skip env sync globally                                      |
| `UV_LOCKED=1`      | `--locked`      | Assert lockfile integrity globally (good for CI env blocks) |
| `UV_NO_PROGRESS=1` | `--no-progress` | Suppress all spinners and bars                              |
| `UV_NO_CACHE=1`    | `--no-cache`    | Disable cache (use in isolated CI if caching causes issues) |

## Gotchas
- `--no-sync` implies `--frozen` — do not combine both flags.
- `--locked` exits with error if `uv.lock` would change — use for assertion only, not for normal dev runs.
- `--frozen` silently uses potentially stale versions — ensure `uv.lock` is committed and correct before using in CI.
- `uv add --dev` writes to `[dependency-groups]` (uv-native); `--optional` writes to `[project.optional-dependencies]` (PEP 508, for published packages).
