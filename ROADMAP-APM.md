# copilot-hub — APM Migration Roadmap

Distribution of copilot-hub packages exclusively via **APM (Agent Package Manager)**.
This document tracks all remaining work and documents the architectural comparison that informed this decision.

---

## Approach Comparison

### copilot-hub (GitHub-hosted, this repo)

**Pros:**
- GitHub-native: consumers reference packages with the short `owner/repo/packages/<name>#vtag` syntax — no PAT setup, no org auth required for public packages
- `microsoft/apm-action@v1` integrates directly with GitHub Actions — no additional CI infrastructure needed
- `apm audit --ci` + lockfile ensure reproducible installs and security scanning (hidden Unicode / prompt injection)
- `apm pack --format plugin` can still produce standalone CLI plugin bundles from the same `.apm/` source if needed
- Multi-runtime: `apm install` deploys to `.github/`, `.claude/`, `.cursor/`, `.opencode/`, `.gemini/` automatically

**Cons:**
- Requires APM CLI on every developer machine (`curl -sSL https://aka.ms/apm-unix | sh`)
- Public repo: all packages are publicly readable (acceptable for this open-source library)

---

### rwest.cao.apm-agent-packages (ADO-hosted, reference implementation)

**Pros:**
- Enterprise auth: supports PAT tokens (`ADO_APM_PAT`) or AAD/Workload Identity Federation — works in orgs where GitHub access is restricted
- Tight Azure DevOps integration: includes `@azure-devops/mcp` server auto-wiring, `ado/*` tools, and ADO-aware agents out-of-the-box
- Monorepo of packages with shared GitVersion versioning across all packages in one pipeline run

**Cons:**
- PAT management burden: each developer must create and rotate a PAT, or configure `az login` as a fallback
- Verbose consumer dependency paths: `dev.azure.com/org/project/_git/repo/packages/<name>` — harder to type and remember than a GitHub shorthand
- No official ADO task for `apm-action` — CI uses `pip install apm-cli` instead
- Packages are internal/private by default — not discoverable outside the ADO organisation

---

### Summary: when to choose which approach

| Factor | copilot-hub (GitHub) | rwest (ADO) |
|---|---|---|
| Auth setup | None (public) or `GITHUB_APM_PAT` for private | PAT or AAD/WIF required |
| Consumer syntax | `gravion/copilot-hub/packages/angular#v1.2.3` | `dev.azure.com/org/project/_git/repo/packages/name` |
| CI integration | `microsoft/apm-action@v1` | `pip install apm-cli` |
| Enterprise compliance | Open-source; not suited for proprietary content | Full enterprise governance |
| Multi-runtime support | ✅ GitHub Copilot, Claude, Cursor, OpenCode, Gemini | ✅ same |

---

## Current State

The `PackageGenerator` (`src/generators/package-generator.ts`) already generates the full APM structure.
Each `packages/<name>/` directory is produced with:

```
packages/<name>/
├── apm.yml              ← generated APM manifest
├── apm.lock.yaml        ← generated lockfile
└── .apm/
    ├── agents/          ← *.agent.md files
    ├── skills/          ← <skill-name>/SKILL.md directories
    └── instructions/    ← *.instructions.md files
```

The entire `packages/` directory is currently **gitignored** (`packages/` in `.gitignore`), so this generated output is not committed. All 15 production packages are ready and waiting.

---

## Phases

### ✅ Prerequisites (already done)

- [x] `PackageGenerator` reads `templates/<domain>/package.yml` and generates `.apm/` + `apm.yml` per package
- [x] `apm.yml` generated for all 15 production packages
- [x] `.apm/agents/`, `.apm/skills/`, `.apm/instructions/` generated per package

---

### Phase 1 — Commit `packages/` content

The generator output exists locally. Stop ignoring it and commit it.

- [ ] Update `.gitignore`: replace `packages/` with `packages/*/apm_modules/`
- [ ] Update CI `regenerate-and-commit` step:
  - Add `git add packages/*/apm.yml packages/*/.apm/`
  - Remove `git add -f plugins/*/agents/ plugins/*/instructions/ plugins/*/skills/`
- [ ] Verify all 15 packages generate cleanly: `npm run build && npm run generate:ci`
- [ ] Confirm `apm.yml` fields comply with the [APM manifest schema](https://microsoft.github.io/apm/reference/manifest-schema/) (required: `name`, `version`; recommended: `description`, `author`, `license`, `includes: auto`)

**Consumer reference syntax after this phase:**
```yaml
dependencies:
  apm:
    - gravion/copilot-hub/packages/angular#v1.2.3
    - gravion/copilot-hub/packages/csharp#v1.2.3
```

---

### Phase 2 — Root `apm.yml` meta-package

Create a root `apm.yml` that acts as a convenience "install everything" entry point — lists all packages and MCP server configurations as dependencies.

- [ ] Create `apm.yml` at repo root with `dependencies.apm` listing all 15 packages (pinned to local paths during development: `./packages/<name>`)
- [ ] Add `dependencies.mcp` entries for any relevant MCP servers (e.g. GitHub MCP, ADO MCP)
- [ ] Decision: **generate** root `apm.yml` from the package list via TS generator/script (auto-sync), OR **maintain manually** (simpler but requires manual update when packages are added/removed)
- [ ] Replace CI force-adds for `.github/agents/`, `.github/skills/`, `.github/instructions/` with `apm install` from root `apm.yml`
- [ ] Commit the `.github/` deployed files after `apm install` (APM best practice: every contributor gets full context on clone, before running `apm install`)

**Example root `apm.yml`:**
```yaml
name: copilot-hub
version: 1.0.0
description: All copilot-hub packages — meta-package for repo contributors
author: Gravion
license: MIT
includes: auto
dependencies:
  apm:
    - ./packages/angular
    - ./packages/common
    - ./packages/copilot-workspace
    - ./packages/csharp
    - ./packages/devops
    # ... all 15 packages
  mcp: []
```

---

### Phase 3 — Update CI to APM tooling

- [ ] Add `microsoft/apm-action@v1` step in `build-test` job for drift check:
  ```yaml
  - name: Install APM packages
    uses: microsoft/apm-action@v1
  - name: Check APM integration drift
    run: |
      apm install
      if [ -n "$(git status --porcelain -- .github/ .claude/ .cursor/)" ]; then
        echo "APM integration files are out of date. Run 'apm install' and commit."
        exit 1
      fi
  ```
- [ ] Add `apm audit --ci` step for lockfile validation + security scan
- [ ] Add `apm_modules/` to `.gitignore`
- [ ] Keep GitVersion (`GitVersion.yml`) and `gh-release` — version bump in `regenerate-and-commit` still patches `apm.yml` version fields

---

### Phase 4 — Remove `gh-copilot-sync` and `gh-copilot-setup`

These skills implemented the old manual file-copy distribution mechanism, which APM replaces entirely.

- [ ] Delete `templates/copilot/skills/gh-copilot-sync/`
- [ ] Delete `templates/copilot/skills/gh-copilot-setup/`
- [ ] Delete `templates/copilot/prompts/gh-copilot-setup.prompt.md`
- [ ] Delete `templates/copilot/prompts/gh-copilot-sync.prompt.md`
- [ ] Remove `gh-copilot-setup` and `gh-copilot-sync` from `templates/copilot-workspace/package.yml` primitives
- [ ] Update `copilot-workspace` package description (remove "bootstrap .github/ from copilot-hub" wording)
- [ ] Search and remove all references in `docs/`, `README.md`, `CONTRIBUTING.md`, `examples/`
- [ ] Remove standalone scripts if only used for sync: `copilot-sync.ps1`, `New-AgentsMd.ps1`

---

### Phase 5 — Deprecate legacy `plugins/` system

The `plugins/` directory uses the old `plugin.config.yml` format and predates the new `packages/` approach.

- [ ] Remove `generateAllPlugins()` and `processPluginConfig()` from `src/index.ts`
- [ ] Delete `src/generators/plugin-generator.ts` and its tests
- [ ] Delete `src/generators/marketplace-generator.ts` and its tests
- [ ] Delete `src/generators/plugin-list-generator.ts` and its tests
- [ ] Remove `--plugins` and marketplace-related CLI args from `src/index.ts`
- [ ] Remove `marketplace.json` and `plugin-list.md` from CI commit step and `.gitignore` entries
- [ ] Delete the `plugins/` directory
- [ ] Update `package.json` scripts: remove `generate:plugins`; update `generate:ci` to not include plugin generation

---

### Phase 6 — Slim TypeScript generator

After phases 4 and 5, the TS generator focuses exclusively on documentation and (optionally) root `apm.yml` generation.

- [ ] Remove `generateMarketplace()` import and call from `generateAggregateDocs()`
- [ ] Remove `generatePluginList()` import and call
- [ ] Remove `--aggregate` plugin portions from CLI; rename to reflect docs-only purpose
- [ ] Optionally: add root `apm.yml` generation to `generateAggregateDocs()` — reads all package `apm.yml` files and writes the meta-package at repo root
- [ ] Keep: `generateAgentList()`, `generateSkillList()`, `generateInstructionList()`, `generateTemplateList()`, `updateReadme()`, `formatAllDocs()`
- [ ] Keep: all Vitest tests for remaining generators; remove tests for deleted generators

---

### Phase 7 — Consumer documentation

- [ ] Add APM getting started section to `README.md`:
  ```yaml
  # apm.yml in your project
  name: my-project
  version: 1.0.0
  dependencies:
    apm:
      - gravion/copilot-hub/packages/angular#v1.2.3
      - gravion/copilot-hub/packages/common#v1.2.3
  ```
  ```bash
  apm install          # first install
  apm install --update # update to latest
  apm audit            # security scan
  ```
- [ ] Document what to commit:
  | Path | Action |
  |---|---|
  | `apm.yml` | ✅ Commit |
  | `apm.lock.yaml` | ✅ Commit |
  | `.github/agents/`, `.github/instructions/`, `.github/skills/` | ✅ Commit (instant context on clone) |
  | `apm_modules/` | ❌ Add to `.gitignore` |
- [ ] Remove all `gh-copilot-sync` / `gh-copilot-setup` references from README and docs
- [ ] Update `CONTRIBUTING.md` to reflect APM-based workflow for contributors

---

## Architecture (target state)

```
copilot-hub/
├── apm.yml                    ← root meta-package (all 15 packages + MCP configs)
├── apm.lock.yaml              ← root lockfile
├── packages/                  ← APM package source (committed)
│   ├── angular/
│   │   ├── apm.yml            ← package manifest
│   │   └── .apm/
│   │       ├── agents/        ← *.agent.md
│   │       ├── skills/        ← <name>/SKILL.md
│   │       └── instructions/  ← *.instructions.md
│   ├── csharp/  common/  devops/  ...
├── templates/                 ← source content (authors edit here)
│   └── <domain>/
│       ├── package.yml        ← package config (primitives, dependencies)
│       ├── agents/
│       ├── skills/
│       └── instructions/
├── src/                       ← TypeScript generator (docs + packages)
│   └── generators/
│       ├── package-generator.ts  ← templates/ → packages/
│       ├── agent-list-generator.ts
│       ├── skill-list-generator.ts
│       └── ...
└── .github/
    ├── agents/                ← deployed by `apm install` from root apm.yml
    ├── skills/                ← deployed by `apm install`
    └── instructions/          ← deployed by `apm install`
```
