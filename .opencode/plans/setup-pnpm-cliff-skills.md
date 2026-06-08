# Plan: Create pnpm-workflow and cliff-setup skills

## Files to Create

### 1. `packages/typescript/.apm/skills/pnpm-workflow/SKILL.md`

```yaml
---
name: pnpm-workflow
description: >
  Set up pnpm as the project package manager and migrate from npm. Installs
  pnpm, converts lockfiles, updates scripts, and configures the project for
  pnpm-based development. Use this skill when starting a new TypeScript/Node.js
  project or migrating an existing npm project to pnpm.
allowed-tools: execute shell runCommands read write edit editFiles search codebase
compatibility: opencode, github-copilot
---
```

Four phases:
1. **Install pnpm** — corepack enable pnpm or npm install -g pnpm
2. **Migrate from npm** — remove package-lock.json, node_modules/, add packageManager field in package.json, create .npmrc with shamefully-hoist=true
3. **Update scripts** — convert npm run → pnpm in package.json scripts
4. **Install dependencies** — pnpm install, verify build passes

### 2. `packages/development-workflow/.apm/skills/cliff-setup/SKILL.md`

```yaml
---
name: cliff-setup
description: >
  Set up git-cliff for conventional-commit changelog generation and integrate it
  into the project workflow. Installs git-cliff, creates or validates cliff.toml
  configuration, generates CHANGELOG.md, and adds a changelog script to
  package.json. Use this skill when setting up changelog generation or updating
  the changelog before a release.
allowed-tools: execute shell runCommands read write edit editFiles search codebase
compatibility: opencode, github-copilot
---
```

Four phases:
1. **Install git-cliff** — cargo install git-cliff (preferred) or npm/pnpm global install
2. **Configure cliff.toml** — validate existing or create with standard conventional-commit config
3. **Generate/update CHANGELOG.md** — initial (full git history) or incremental (--unreleased with tag)
4. **Integrate into workflow** — add changelog script to package.json scripts

## Files to Modify

### 3. `packages/typescript/apm.yml`

Add skills section:
```yaml
skills:
  - pnpm-workflow
```

### 4. `packages/development-workflow/apm.yml`

Add skills section:
```yaml
skills:
  - cliff-setup
```

### 5. `packages/development-workflow/.apm/agents/dev-workflow.agent.md`

Add to Phase 1 (Plan) before step 1:
```
- Load pnpm-workflow skill to ensure pnpm is set up
```

Add to Phase 3 (Verify) after step 6 (before commit):
```
- Load cliff-setup skill to update CHANGELOG.md
```

### 6. `packages/development-workflow/.apm/agents/opencode-workflow.agent.md`

In Pipeline section, before step 1 (plan spawn):
```
- Load pnpm-workflow via skill(pnpm-workflow) to ensure pnpm is set up
```

After step 4 (verify), before reporting:
```
- Load cliff-setup via skill(cliff-setup) to update changelog
```

## Execution Order

1. Create `packages/typescript/.apm/skills/pnpm-workflow/` directory + SKILL.md
2. Create `packages/development-workflow/.apm/skills/cliff-setup/` directory + SKILL.md
3. Edit `packages/typescript/apm.yml`
4. Edit `packages/development-workflow/apm.yml`
5. Edit `dev-workflow.agent.md`
6. Edit `opencode-workflow.agent.md`
