---
name: gh-copilot-sync
description: 'Sync installed GitHub Copilot configuration files (.github/instructions, prompts, agents) with the latest versions from GravionLabs/copilot-hub.'
allowed-tools: codebase runCommands editFiles
---

Sync existing `.github/` Copilot configuration files to their latest versions from GravionLabs/copilot-hub.

## What this skill does
Compares currently installed instructions, prompts, and agents against the latest versions in copilot-hub, applies updates, and reports on newly available templates not yet installed.

## Prerequisites
- `pwsh` (PowerShell Core) installed
- `gh` CLI installed and authenticated (`gh auth status`)
- Files already installed (run `gh-copilot-setup` first for initial setup)

## Steps
1. Check prerequisites: verify `pwsh` and `gh` are available
2. Discover installed files in `.github/instructions/`, `.github/prompts/`, `.github/agents/`
3. Also check `~/.github` if a global base directory is configured
4. Fetch latest versions of each installed file from `GravionLabs/copilot-hub`
5. Show a diff summary of what would change; ask for confirmation (unless `--autopilot`)
6. Apply updates to changed files
7. Report any newly available templates in copilot-hub that aren't installed yet

## Flags
- `--autopilot`: skip confirmation prompts, apply all updates non-interactively

## Constraints
- Only updates files that are already installed — does not install new categories
- Preserves local customizations by showing diffs before overwriting
- For first-time setup, use `gh-copilot-setup` instead
