# Changelog

All notable changes to GravionLabs/copilot-hub are documented here.
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.0.28] — 2026-04-05

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



