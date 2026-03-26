# Changelog

All notable changes to GravionLabs/copilot-hub are documented here.
Versioning follows [Semantic Versioning](https://semver.org/).

---

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



