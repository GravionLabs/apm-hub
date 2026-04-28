# Changelog

All notable changes to GravionLabs/copilot-hub are documented here.
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.0.39] — 2026-04-28

### Features
- Add playwright-cli-developer skill for enhanced Playwright test management


## [1.0.38] — 2026-04-28

### Documentation
- Update CHANGELOG.md for v1.0.38 [skip ci]


### Refactoring
- Standardize readonly #field pattern for injected dependencies


## [1.0.37] — 2026-04-28

### Documentation
- Update CHANGELOG.md for v1.0.37 [skip ci]


## [1.0.36] — 2026-04-26

### Documentation
- Update CHANGELOG.md for v1.0.36 [skip ci]


## [1.0.35] — 2026-04-14

### Bug Fixes
- Add Copilot CLI permission kinds to allowed-tools in 3 skills


### Documentation
- Add allowed-tools platform reference to skills and docs
- Update CHANGELOG.md for v1.0.35 [skip ci]


### Features
- Add skill references to agent files (closes #80)
- Add cross-platform allowed-tools guidance to create-skill and skill-audit


## [1.0.34] — 2026-04-12

### Documentation
- Update CHANGELOG.md for v1.0.34 [skip ci]


### Features
- **go**: Audit and refresh Go templates (#49)


## [1.0.33] — 2026-04-06

### Documentation
- Update CHANGELOG.md for v1.0.33 [skip ci]


### Features
- Template-list — separate tables per type for better readability (closes #88)


## [1.0.32] — 2026-04-06

### Bug Fixes
- Restore steps 3-4 and add conditional values file examples in helm-template-validate SKILL.md
- Restore doc generation for new template directory structure
- Ensure output directory exists before writing marketplace.json (closes #86)
- Update branch type labels in SKILL.md and Start-Issue.ps1 (closes #86)
- Standardize branch naming conventions across skills and instructions (closes #84)


### Documentation
- Clarify model/version fields are aspirational in agentskills-spec
- Update CHANGELOG.md for v1.0.32 [skip ci]


### Features
- **templates/python**: Refresh python templates for issue #51
- **templates/typescript**: Refresh typescript templates for issue #52
- **typescript**: Finalize issue #52 — trim mcp-server-generator SKILL.md, update plugin config
- **typescript**: Enrich TypeScript skills with templates, PS1 scripts, and task tips
- Add create-node-project and create-angular-project scaffolding skills
- Python templates refresh — Issue #51
- Skill model hints, gh-issue-implement scripts, gh-* install
- Add model hint to SKILL.md body + branch format fix
- **helm**: Audit and refresh templates for issue #50


### Refactoring
- Rename list-generator-base.ts to list-generator.ts


## [1.0.31] — 2026-04-05

### Bug Fixes
- Generator SKILL.md basename bug, devops agents config, and template-list links
- **generator**: Fix agent-list-generator to scan agents/ subdirectory


### Documentation
- Update skill source resolution comments to directory layout
- Update CHANGELOG.md for v1.0.31 [skip ci]


### Features
- **templates**: Restructure templates to domain/type layout
- **skill**: Enrich create-dotnet-solution companion templates
- **skill**: Use slnx, minimal .csproj, package update support
- **templates**: Migrate all skills to agentskills.io directory layout (*/SKILL.md)
- **generator**: Rewrite template-list-generator for domain/type subdirectory layout


## [1.0.30] — 2026-04-05

### Documentation
- Update CHANGELOG.md for v1.0.30 [skip ci]


### Features
- **csharp**: Companion templates for csharp-mcp-server-generator skill (#67)


## [1.0.29] — 2026-04-05

### Documentation
- Update CHANGELOG.md for v1.0.29 [skip ci]


### Features
- **generator**: Spec compliance, companion dirs, new plugin.json fields


## [1.0.28] — 2026-04-05

### Documentation
- Update CHANGELOG.md for v1.0.28 [skip ci]


### Features
- **python**: Add plugin, fix agents, new skills, update instructions


## [1.0.27] — 2026-04-05

### Documentation
- Update CHANGELOG.md for v1.0.27 [skip ci]


### Features
- **devops**: Fix agents, add 4 skills, github-actions instructions


## [1.0.26] — 2026-04-05

### Documentation
- Update CHANGELOG.md for v1.0.26 [skip ci]


### Features
- **csharp**: Fix 9 agents, add debug skill, Stack blocks, C#13/14 instructions


## [1.0.25] — 2026-04-05

### Documentation
- Update CHANGELOG.md for v1.0.25 [skip ci]


### Features
- **security**: Add 5 skills, fix agents, expand instructions


## [1.0.24] — 2026-04-05

### Documentation
- Update CHANGELOG.md for v1.0.24 [skip ci]


### Features
- **postgresql**: Create plugin; add agents, skills, instructions (#45)


## [1.0.23] — 2026-04-05

### Documentation
- Update CHANGELOG.md for v1.0.23 [skip ci]


### Features
- **playwright**: Add skills, instructions, debug skill; fix agent frontmatter (#44)


## [1.0.22] — 2026-04-05

### Documentation
- Update CHANGELOG.md for v1.0.22 [skip ci]


### Features
- **docker**: Add agents, debug/security/compose skills; modernize instructions (#43)


## [1.0.21] — 2026-04-05

### Documentation
- Update CHANGELOG.md for v1.0.21 [skip ci]


### Features
- **terraform**: Add plan-debugger, drift-detection skills; terraform-reviewer agent; modernize instructions (#42)


## [1.0.20] — 2026-04-05

### Bug Fixes
- **angular-testing**: Add missing vi, signal, fakeAsync, tick imports to prompt examples
- **angular-code-review**: Use space-separated allowed-tools (no commas)


### Documentation
- **angular**: Add ## Stack section to angular-migration skill for CLI prerequisites
- Update CHANGELOG.md for v1.0.20 [skip ci]


### Features
- **angular**: Add code-review, testing, migration templates; fix agent frontmatter (#41)


## [1.0.19] — 2026-04-04

### Documentation
- Fix outdated references after domain template restructuring (#39)
- Update CHANGELOG.md for v1.0.19 [skip ci]


## [1.0.18] — 2026-04-04

### Bug Fixes
- Remove generated aggregate docs from branch, extend CI check


### Documentation
- Update CHANGELOG.md for v1.0.18 [skip ci]


## [1.0.17] — 2026-04-04

### Documentation
- Update CHANGELOG.md for v1.0.17 [skip ci]


### Features
- Restructure templates into domain-based directories (issue #36)
- Add domain-based template, agent, instruction lists; fix skill-list


## [1.0.16] — 2026-04-04

### Documentation
- Update CHANGELOG.md for v1.0.16 [skip ci]


### Refactoring
- Treat plugin agents, instructions, skills as generated artifacts


## [1.0.15] — 2026-04-04

### Documentation
- Update CHANGELOG.md for v1.0.15 [skip ci]


### Features
- Templates/skills/ as single source of truth for plugin skills


## [1.0.14] — 2026-04-04

### Documentation
- Update CHANGELOG.md for v1.0.14 [skip ci]


## [1.0.13] — 2026-04-04

### Documentation
- Clarify Skills vs Prompts — plugin support, allowed-tools semantics, generator limitations
- Update CHANGELOG.md for v1.0.13 [skip ci]


## [1.0.12] — 2026-04-04

### Bug Fixes
- Standardize placeholder to {issue-number} in gh-issue-work SKILL.md
- Update plugin versions to 1.0.5 and standardize skill names
- Remove marketplace.json from feature branch


### Documentation
- Update CHANGELOG.md for v1.0.12 [skip ci]


### Features
- Rename prompts/skills to domain-first naming convention
- Split generate into safe local vs CI-only aggregate
- Update plugin versions to 1.0.11 and enhance skill descriptions
- Add skills for issue workflow management


## [1.0.11] — 2026-04-03

### Documentation
- Add global sharing guide and update concept docs with global paths
- Fix tool support matrix column header inconsistency
- Update CHANGELOG.md for v1.0.11 [skip ci]


## [1.0.10] — 2026-04-03

### Bug Fixes
- Standardize frontmatter in all prompt templates


### Documentation
- Add Phase 10 prompt template quality to ROADMAP.md
- Update CHANGELOG.md for v1.0.10 [skip ci]


## [1.0.9] — 2026-04-03

### Documentation
- Update CHANGELOG.md for v1.0.9 [skip ci]


### Features
- Add issue workflow skills and fix generator allowed-tools mapping


## [1.0.8] — 2026-04-03

### Documentation
- Update CHANGELOG.md for v1.0.8 [skip ci]


## [1.0.7] — 2026-04-03

### Documentation
- Update CHANGELOG.md for v1.0.7 [skip ci]


## [1.0.6] — 2026-04-03

### Bug Fixes
- Restore generate script and normalize generate:* naming
- Replace direct push with auto-PR in update-docs job
- Use GH_PAT for update-docs push to bypass branch protection
- Pass GH_PAT to gh-release action and release job checkout


### Documentation
- Add subagents and hooks concepts, update skills and mental model
- Update overview.md with version notice, official docs reference, and updated concepts table
- Add Mermaid diagrams to mental-model and overview
- Translate subtask-model-instructions.md from German to English
- Update CHANGELOG.md for v1.0.6 [skip ci]


### Features
- Add typescript-node-development plugin (#8)
- Add cross-platform Mermaid diagram support (GitHub + Azure DevOps)
- Update plugin versions, add new plugins and improve formatting


## [1.0.5] — 2026-03-28

### Documentation
- Update CHANGELOG.md for v1.0.5 [skip ci]


## [1.0.4] — 2026-03-28

### Documentation
- Update CHANGELOG.md for v1.0.4 [skip ci]


### Features
- Add terraform-development plugin (#9)
- Add helm-development plugin (#10)
- Add go-development plugin (#11)


## [1.0.3] — 2026-03-28

### Documentation
- Update CHANGELOG.md for v1.0.3 [skip ci]


## [1.0.2] — 2026-03-28

### Documentation
- Add “Further Reading” sections with external GitHub Docs links
- Update CHANGELOG.md for v1.0.2 [skip ci]


### Features
- Update agent, instruction and prompt files
- Add python-development plugin (#7)


## [1.0.1] — 2026-03-27

### Documentation
- Update CHANGELOG.md for v1.0.1 [skip ci]


## [1.0.0] — 2026-03-26

### Bug Fixes
- Sync-wiki.yml — handle uninitialized wiki repo
- Update Node.js version to 24 in generate-docs.yml
- Move marketplace.json to .github/plugin/ for gh copilot compatibility
- Update marketplace.json format to match gh copilot schema
- Owner must be object {login} not string in marketplace.json
- Add owner.name to marketplace.json schema


### Documentation
- Comprehensive docs/ update
- Replace old sync mechanism with copilot-workspace docs
- Add Skills concept documentation and auto-generated skill list
- Update CHANGELOG.md for v1.0.0 [skip ci]


### Features
- Add markdown table formatter, auto-docs pipeline, CI workflow prompts, plugin expansions
- Add configuration files for Python module, Prettier settings, and Jest test runner
- Add custom marketplace, plugin install guide, and wiki sync
- Wiki sync via ci reusable workflow + create-wiki-workflow prompt/skill
- Add copilot-workspace plugin to marketplace.json and docs
- Add angular-development plugin
- Add CI configuration, changelog, and GitVersion support
- Add AGENTS.md scaffolding and update plugin descriptions
- Add CI test script for running tests in continuous integration
- Enable test coverage reporting in CI


### Refactoring
- Remove outdated scripts and config files, update sync logic



