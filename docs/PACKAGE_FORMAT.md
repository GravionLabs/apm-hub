---
description: Package manifest format (package.yml) for unified distribution to both Copilot Hub and APM
---

# Package Manifest Format (package.yml)

Package manifests (`templates/<domain>/package.yml`) define AI packages for unified distribution to both GitHub Copilot Hub and APM (Automated Package Manager).

## Overview

Each domain in `templates/` contains a single `package.yml` that serves as the **single source of truth** for all package metadata. The CI build system reads these manifests and generates:

1. **`.github/` runtimes** — for Copilot Hub (includes draft + production packages)
2. **`.apm/` runtimes** — for APM (includes production packages only)
3. **`apm.yml`** — APM package manifest (generated, production only)
4. **`apm.lock.yaml`** — APM lockfile (generated, production only)

All generated outputs are **gitignored** and regenerated automatically on `main` branch.

## Format Specification

### Required Fields

```yaml
name: angular
version: "1.0.0"
description: >-
  Angular 21+ full-stack development plugin with standalone components,
  NgRx Signal Store, PrimeNG, ESLint/Prettier, and Vitest.
status: production
```

#### `name`
- Package identifier (lowercase, hyphen-separated, no spaces)
- Examples: `common`, `angular`, `typescript-node-development`
- Used in directory names and APM package identifiers

#### `version`
- Semantic version (MAJOR.MINOR.PATCH)
- Examples: `1.0.0`, `2.1.3`
- Included in generated `apm.yml` manifest

#### `description`
- Human-readable package description
- Can use YAML multiline syntax (`>` or `|`)
- Included in generated manifests

#### `status` (Required for filtering)

Controls which distribution channels include this package:

| Status | Hub | APM | Meaning |
|--------|-----|-----|---------|
| `production` | ✅ | ✅ | Ready for release; published to all channels |
| `draft` | ✅ | ❌ | In development; Hub only (internal testing) |
| `obsolete` | ❌ | ❌ | Deprecated; kept for reference only; not published |

**Examples:**

```yaml
# Released and publicly available
status: production

# Under active development (internal testing only)
status: draft

# Deprecated but kept in repo for reference
status: obsolete
```

### Optional Fields

```yaml
author:
  name: Gravion
  email: info@gravion.de
  url: https://gravion.de

license: MIT

keywords:
  - angular
  - ngrx
  - signals
  - primeng
  - typescript
  - development
```

#### `author`
- Optional author information
- Fields: `name` (required if present), `email`, `url`

#### `license`
- SPDX license identifier
- Common values: `MIT`, `Apache-2.0`, `GPL-3.0`, `BSD-2-Clause`

#### `keywords`
- Array of searchable tags
- Used for discovery and organization
- Examples: language, framework, tool, practice

### Primitives

The `primitives` section lists all agents, skills, and instructions included in this package.

```yaml
primitives:
  agents:
    - source: angular/agents/angular-expert
    - source: angular/agents/angular-library-architect
    - source: angular/agents/sakai-ui-expert

  skills:
    - name: create-angular-project
      source: angular/skills/create-angular-project
    - name: angular-component
      source: angular/skills/angular-component

  instructions:
    - source: angular/instructions/angular
    - source: angular/instructions/ngrx-signals
    - source: angular/instructions/sakai-ui
```

#### Agents

```yaml
agents:
  - source: <domain>/agents/<agent-name>
```

- `source`: Path to agent file (relative to `templates/`)
- Files: `templates/<domain>/agents/<agent-name>.agent.md`
- Copied as-is to `.github/agents/` and `.apm/agents/`

#### Skills

```yaml
skills:
  - name: <skill-display-name>
    source: <domain>/skills/<skill-name>
    extend:  # optional
      - <extend-source>
```

- `name`: Skill identifier (required); used for display
- `source`: Path to skill (relative to `templates/`)
- Files:
  - Directory layout: `templates/<domain>/skills/<skill-name>/SKILL.md`
  - Flat layout: `templates/<domain>/skills/<skill-name>.skill.md`
- `extend` (optional): Additional source paths to append to body

#### Instructions

```yaml
instructions:
  - source: <domain>/instructions/<instruction-name>
```

- `source`: Path to instruction file (relative to `templates/`)
- Files: `templates/<domain>/instructions/<instruction-name>.instructions.md`
- Copied as-is to `.github/instructions/` and `.apm/instructions/`

### APM-Specific Metadata (Optional)

```yaml
apm:
  dependencies:
    apm: []        # APM package dependencies (currently unused)
    mcp: []        # MCP server dependencies (e.g. for Claude)
  tags:
    - shared
    - workflow
```

#### `apm.dependencies`

- `apm`: List of APM package IDs this package depends on
- `mcp`: List of MCP servers required (experimental)
- Currently for documentation; not enforced by APM

#### `apm.tags`

- Free-form tags for organization in APM marketplace
- Examples: `shared`, `workflow`, `linting`, `testing`, `ai-native`

### Copilot Hub-Specific Metadata (Optional)

```yaml
copilot:
  tags:
    - angular
    - web
    - framework
```

#### `copilot.tags`

- Free-form tags for Copilot Hub organization
- Examples: `language`, `framework`, `testing`, `devops`, `security`

## Complete Example

```yaml
name: angular
version: "1.0.0"
description: >-
  Angular 21+ full-stack development plugin.
  Covers standalone components, NgRx Signal Store, Angular libraries,
  PrimeNG, ESLint/Prettier setup, sakai-ui conventions, and testing with Vitest.

author:
  name: Gravion
  email: info@gravion.de

license: MIT

status: production

keywords:
  - angular
  - ngrx
  - signals
  - primeng
  - sakai-ui
  - typescript
  - development

primitives:
  agents:
    - source: angular/agents/angular-expert
    - source: angular/agents/angular-library-architect
    - source: angular/agents/sakai-ui-expert

  skills:
    - name: create-angular-project
      source: angular/skills/create-angular-project
    - name: setup-prettier-eslint-husky
      source: typescript/skills/setup-prettier-eslint-husky
    - name: angular-component
      source: angular/skills/angular-component
    - name: sakai-ui-component
      source: angular/skills/sakai-ui-component
    - name: angular-signal-store
      source: angular/skills/angular-signal-store
    - name: angular-library-create
      source: angular/skills/angular-library-create
    - name: angular-code-review
      source: angular/skills/angular-code-review
    - name: angular-testing
      source: angular/skills/angular-testing
    - name: angular-migration
      source: angular/skills/angular-migration

  instructions:
    - source: angular/instructions/angular
    - source: angular/instructions/ngrx-signals
    - source: angular/instructions/sakai-ui

apm:
  tags: [angular, ngrx, signals]

copilot:
  tags: [angular, framework, typescript]
```

## Generation Workflow

When you commit to `main`:

1. **CI reads**: `templates/<domain>/package.yml`
2. **Filters by status**:
   - Hub: `production` + `draft`
   - APM: `production` only
3. **Generates for each package**:
   - Copy primitives from `templates/` to `packages/<domain>/.github/` and `packages/<domain>/.apm/`
   - Generate `packages/<domain>/apm.yml` (metadata only)
   - Generate `packages/<domain>/apm.lock.yaml` (lockfile)
4. **Updates indices**:
   - `.github/plugin/marketplace.json`
   - `docs/agent-list.md`, `docs/skill-list.md`, etc.
5. **Auto-commits** to `main` with message: `chore: regenerate plugin artifacts, docs and manifests [skip ci]`

## Usage: Adding a New Package

1. Create directory: `templates/<domain>/`
2. Create manifest: `templates/<domain>/package.yml`
3. Add agents/skills/instructions in subdirectories
4. Reference them in `primitives` section
5. Push to feature branch → opens PR
6. Merge to `main` → CI generates and commits outputs

## Usage: Changing Package Status

To move a package from draft to production:

```yaml
# Before (draft):
status: draft

# After (production):
status: production
```

Commit to `main` → CI regenerates and publishes to APM.

## Usage: Deprecating a Package

To deprecate a package but keep it in the repo:

```yaml
# Before (production):
status: production

# After (obsolete):
status: obsolete
```

The package remains in the repository but is not published to any channel.

## Git Strategy

- **Tracked in repo**: `templates/*/package.yml` (source of truth)
- **Generated (gitignored)**: `packages/` (all outputs)
- **Generated (forced-committed)**: `.github/plugin/marketplace.json`, `docs/*.md`

Feature branches should only modify `templates/*/package.yml` and package content (agents, skills, instructions). The CI system regenerates all outputs.

## Validation

The package generator validates:

- ✅ `package.yml` exists for each domain with `templates/*/package.yml` subdirectories
- ✅ `status` field is one of: `draft`, `production`, `obsolete`
- ✅ Source paths in `primitives` can be resolved to files in `templates/`
- ✅ Generated files are written to `packages/<domain>/`

Failed validation is logged as warnings but doesn't block generation.
