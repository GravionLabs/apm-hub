---
name: gh-copilot-setup
description: >
  Installs GitHub Copilot configuration (instructions, prompts, agents) from
  GravionLabs/copilot-hub into .github/. Use this skill when setting up Copilot
  in a repository for the first time — even if the user just says "configure Copilot"
  or "add Copilot instructions." Requires pwsh and gh CLI. For ongoing sync of
  already-installed files, use gh-copilot-sync instead.
allowed-tools: execute read edit search codebase editFiles runCommands
model: gpt-4.1
---

Bootstrap GitHub Copilot configuration for a repository from GravionLabs/copilot-hub.

## What this skill does
Interactively browses the copilot-hub repository, lets the user select relevant Instructions/Prompts/Agents, installs them to `.github/`, and generates a `copilot-instructions.md`.

## Prerequisites
- `pwsh` (PowerShell Core) installed
- `gh` CLI installed and authenticated (`gh auth status`)
- Run from the repository root

## Steps
1. Check prerequisites: verify `pwsh` and `gh` are available
2. Fetch available templates from `GravionLabs/copilot-hub` via `gh api` or `gh release`
3. Detect the project type by scanning for indicator files (`.csproj`, `package.json`, `pyproject.toml`, etc.)
4. Present matching templates grouped by category (instructions, prompts, agents); ask user to confirm selection
5. Download selected files into `.github/instructions/`, `.github/prompts/`, `.github/agents/`
6. If a global base directory (`~/.github`) is configured, optionally install there too
7. Generate or update `.github/copilot-instructions.md` referencing installed files
8. Summarize what was installed

## Flags
- `--autopilot`: skip confirmation prompts, install all recommended templates non-interactively

## Constraints
- For ongoing sync of already-installed files, use `gh-copilot-sync` instead
- Never overwrite customized files without user confirmation (unless `--autopilot`)

> 💡 **Model hint:** This is a mechanical task — a fast model like `gpt-4.1` is sufficient. Use `/model` to switch.
