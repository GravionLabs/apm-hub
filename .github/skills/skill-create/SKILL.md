---
name: skill-create
description: >
  Creates a complete agent skill. Use this skill when building or scaffolding a
  new skill from a prompt, rough idea, or domain name, even if the request is
  underspecified.
allowed-tools: read search codebase write edit editFiles
---

## Overview

Create the smallest skill that still captures the required workflow.
Avoid verbose reasoning.

**PowerShell requirement:** All shell code blocks must use ` ```powershell ` syntax. This is enforced by skill-write and skill-audit.

## Prerequisites

- Skill name
- Target location and domain
- **Shell requirement:** If the skill will contain shell examples, they must be written in PowerShell syntax

## Instructions

1. Pick the location:
   - Use `packages/<domain>/.apm/skills/<name>/` for domain workflows.
   - Use `.github/skills/<name>/` only for repo-level skill tooling.
   - If no package fits, create one with `apm.yml`.
2. Validate the name: kebab-case, 1-64 chars, matches the directory.
3. Use skill `skill-write` to draft and validate the SKILL.md content. skill-write will enforce PowerShell syntax for all shell code.
4. Final validation: name matches directory, description is specific, body stays
   focused, references are only loaded conditionally, and all shell code uses PowerShell.

## Gotchas

- Directory name must match `name` exactly.
- PowerShell is required for all shell code — skill-write will enforce this.
