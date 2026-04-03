# Changelog

All notable changes to GravionLabs/copilot-hub are documented here.
Versioning follows [Semantic Versioning](https://semver.org/).

---

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



