# Changelog

All notable changes to GravionLabs/apm-hub are documented here.
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.0.4] — 2026-06-09

### Bug Fixes
- Update Detect-TechStack.ps1 for recursive scanning and packageManager detection (#18)
- Make packageManager an array, exclude node_modules from scans (#18)
- Increase max depth to 5 for recursive scans (#18)
- Detect slnx files, map languages to skill prefixes (#18)


## [1.0.3] — 2026-06-09

### Documentation
- Update CHANGELOG.md for v1.0.3 [skip ci]


## [1.0.2] — 2026-06-08

### Bug Fixes
- Skip puppeteer Chrome download in CI build-test job (#15)
- Update CI to use pnpm with GravionLabs/ci/node composites (#15)
- Remove --if-present from build commands (pnpm doesn't support it)
- Remove deleted packages from all/meta, fix dev-workflow deps format
- Libasound2 -> libasound2t64 for Ubuntu 24.04 Noble
- Allow determine-version on workflow_dispatch so full release pipeline runs


### Documentation
- Update CHANGELOG.md for v1.0.2 [skip ci]


### Features
- Add pnpm-workflow and cliff-setup skills (#15)
- Add detect-techstack, <lang>-build, and <lang>-test skills (#15)


### Refactoring
- Extract planning agent, strip dev-workflow, add modes to opencode-workflow
- Rename dev-workflow → implement-workflow, opencode-workflow → dev-workflow


## [1.0.1] — 2026-05-04

### Documentation
- Update CHANGELOG.md for v1.0.1 [skip ci]


## [1.0.0] — 2026-05-04

### Bug Fixes
- Sync-wiki.yml — handle uninitialized wiki repo
- Update Node.js version to 24 in generate-docs.yml
- Move marketplace.json to .github/plugin/ for gh copilot compatibility
- Update marketplace.json format to match gh copilot schema
- Owner must be object {login} not string in marketplace.json
- Add owner.name to marketplace.json schema
- Restore generate script and normalize generate:* naming
- Replace direct push with auto-PR in update-docs job
- Use GH_PAT for update-docs push to bypass branch protection
- Pass GH_PAT to gh-release action and release job checkout
- Standardize frontmatter in all prompt templates
- Standardize placeholder to {issue-number} in gh-issue-work SKILL.md
- Update plugin versions to 1.0.5 and standardize skill names
- Remove marketplace.json from feature branch
- Remove generated aggregate docs from branch, extend CI check
- **angular-testing**: Add missing vi, signal, fakeAsync, tick imports to prompt examples
- **angular-code-review**: Use space-separated allowed-tools (no commas)
- Generator SKILL.md basename bug, devops agents config, and template-list links
- **generator**: Fix agent-list-generator to scan agents/ subdirectory
- Restore steps 3-4 and add conditional values file examples in helm-template-validate SKILL.md
- Restore doc generation for new template directory structure
- Ensure output directory exists before writing marketplace.json (closes #86)
- Update branch type labels in SKILL.md and Start-Issue.ps1 (closes #86)
- Standardize branch naming conventions across skills and instructions (closes #84)
- Add Copilot CLI permission kinds to allowed-tools in 3 skills
- Remove devDependencies, commit .github/ directly, fix apm audit
- Use github.token fallback in CI when GH_PAT is not set
- Rename plan agent to planning avoid OpenCode built-in collision (#8)


### Documentation
- Comprehensive docs/ update
- Replace old sync mechanism with copilot-workspace docs
- Add Skills concept documentation and auto-generated skill list
- Update CHANGELOG.md for v1.0.0 [skip ci]
- Update CHANGELOG.md for v1.0.1 [skip ci]
- Add “Further Reading” sections with external GitHub Docs links
- Update CHANGELOG.md for v1.0.2 [skip ci]
- Update CHANGELOG.md for v1.0.3 [skip ci]
- Update CHANGELOG.md for v1.0.4 [skip ci]
- Update CHANGELOG.md for v1.0.5 [skip ci]
- Add subagents and hooks concepts, update skills and mental model
- Update overview.md with version notice, official docs reference, and updated concepts table
- Add Mermaid diagrams to mental-model and overview
- Translate subtask-model-instructions.md from German to English
- Update CHANGELOG.md for v1.0.6 [skip ci]
- Update CHANGELOG.md for v1.0.7 [skip ci]
- Update CHANGELOG.md for v1.0.8 [skip ci]
- Update CHANGELOG.md for v1.0.9 [skip ci]
- Add Phase 10 prompt template quality to ROADMAP.md
- Update CHANGELOG.md for v1.0.10 [skip ci]
- Add global sharing guide and update concept docs with global paths
- Fix tool support matrix column header inconsistency
- Update CHANGELOG.md for v1.0.11 [skip ci]
- Update CHANGELOG.md for v1.0.12 [skip ci]
- Clarify Skills vs Prompts — plugin support, allowed-tools semantics, generator limitations
- Update CHANGELOG.md for v1.0.13 [skip ci]
- Update CHANGELOG.md for v1.0.14 [skip ci]
- Update CHANGELOG.md for v1.0.15 [skip ci]
- Update CHANGELOG.md for v1.0.16 [skip ci]
- Update CHANGELOG.md for v1.0.17 [skip ci]
- Update CHANGELOG.md for v1.0.18 [skip ci]
- Fix outdated references after domain template restructuring (#39)
- Update CHANGELOG.md for v1.0.19 [skip ci]
- **angular**: Add ## Stack section to angular-migration skill for CLI prerequisites
- Update CHANGELOG.md for v1.0.20 [skip ci]
- Update CHANGELOG.md for v1.0.21 [skip ci]
- Update CHANGELOG.md for v1.0.22 [skip ci]
- Update CHANGELOG.md for v1.0.23 [skip ci]
- Update CHANGELOG.md for v1.0.24 [skip ci]
- Update CHANGELOG.md for v1.0.25 [skip ci]
- Update CHANGELOG.md for v1.0.26 [skip ci]
- Update CHANGELOG.md for v1.0.27 [skip ci]
- Update CHANGELOG.md for v1.0.28 [skip ci]
- Update CHANGELOG.md for v1.0.29 [skip ci]
- Update CHANGELOG.md for v1.0.30 [skip ci]
- Update skill source resolution comments to directory layout
- Update CHANGELOG.md for v1.0.31 [skip ci]
- Clarify model/version fields are aspirational in agentskills-spec
- Update CHANGELOG.md for v1.0.32 [skip ci]
- Update CHANGELOG.md for v1.0.33 [skip ci]
- Update CHANGELOG.md for v1.0.34 [skip ci]
- Add allowed-tools platform reference to skills and docs
- Update CHANGELOG.md for v1.0.35 [skip ci]
- Update CHANGELOG.md for v1.0.36 [skip ci]
- Update CHANGELOG.md for v1.0.37 [skip ci]
- Update CHANGELOG.md for v1.0.38 [skip ci]
- Update CHANGELOG.md for v1.0.39 [skip ci]
- Add PACKAGE_FORMAT.md guide for package.yml manifest format
- Update CHANGELOG.md for v1.0.40 [skip ci]
- Update CHANGELOG.md for v1.0.41 [skip ci]
- Correct model field platform support across agent skills
- Model is officially supported in both GitHub Copilot and Claude Code
- Update agents and skills documentation for APM packages
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
- Update agent, instruction and prompt files
- Add python-development plugin (#7)
- Add terraform-development plugin (#9)
- Add helm-development plugin (#10)
- Add go-development plugin (#11)
- Add typescript-node-development plugin (#8)
- Add cross-platform Mermaid diagram support (GitHub + Azure DevOps)
- Update plugin versions, add new plugins and improve formatting
- Add issue workflow skills and fix generator allowed-tools mapping
- Rename prompts/skills to domain-first naming convention
- Split generate into safe local vs CI-only aggregate
- Update plugin versions to 1.0.11 and enhance skill descriptions
- Add skills for issue workflow management
- Templates/skills/ as single source of truth for plugin skills
- Restructure templates into domain-based directories (issue #36)
- Add domain-based template, agent, instruction lists; fix skill-list
- **angular**: Add code-review, testing, migration templates; fix agent frontmatter (#41)
- **terraform**: Add plan-debugger, drift-detection skills; terraform-reviewer agent; modernize instructions (#42)
- **docker**: Add agents, debug/security/compose skills; modernize instructions (#43)
- **playwright**: Add skills, instructions, debug skill; fix agent frontmatter (#44)
- **postgresql**: Create plugin; add agents, skills, instructions (#45)
- **security**: Add 5 skills, fix agents, expand instructions
- **csharp**: Fix 9 agents, add debug skill, Stack blocks, C#13/14 instructions
- **devops**: Fix agents, add 4 skills, github-actions instructions
- **python**: Add plugin, fix agents, new skills, update instructions
- **generator**: Spec compliance, companion dirs, new plugin.json fields
- **csharp**: Companion templates for csharp-mcp-server-generator skill (#67)
- **templates**: Restructure templates to domain/type layout
- **skill**: Enrich create-dotnet-solution companion templates
- **skill**: Use slnx, minimal .csproj, package update support
- **templates**: Migrate all skills to agentskills.io directory layout (*/SKILL.md)
- **generator**: Rewrite template-list-generator for domain/type subdirectory layout
- **templates/python**: Refresh python templates for issue #51
- **templates/typescript**: Refresh typescript templates for issue #52
- **typescript**: Finalize issue #52 — trim mcp-server-generator SKILL.md, update plugin config
- **typescript**: Enrich TypeScript skills with templates, PS1 scripts, and task tips
- Add create-node-project and create-angular-project scaffolding skills
- Python templates refresh — Issue #51
- Skill model hints, gh-issue-implement scripts, gh-* install
- Add model hint to SKILL.md body + branch format fix
- **helm**: Audit and refresh templates for issue #50
- Template-list — separate tables per type for better readability (closes #88)
- **go**: Audit and refresh Go templates (#49)
- Add skill references to agent files (closes #80)
- Add cross-platform allowed-tools guidance to create-skill and skill-audit
- Add playwright-cli-developer skill for enhanced Playwright test management
- Unified package architecture with package.yml and generator
- Migrate to APM-only distribution
- Rename to apm-hub
- Add APM marketplace, clean CHANGELOG for v1.0.0
- Restructure packages into domain-based layout (#3)
- Meta-package, clean .github/ tracked files, copilot-setup-steps
- Add development-workflow package with multi-repo support
- Add PR body template and update README with skill instructions
- Add agent-write, agent-create, agent-audit, agent-update skills
- Add integration tests and configuration for Copilot SDK
- Create apm-tooling package with skill lifecycle skills


### Refactoring
- Remove outdated scripts and config files, update sync logic
- Treat plugin agents, instructions, skills as generated artifacts
- Rename list-generator-base.ts to list-generator.ts
- Standardize readonly #field pattern for injected dependencies
- Rename csharp to dotnet, merge ag-grid into angular, rename apm-workspace skills
- Replace docs/model-overview.md refs with local model-selection.md in agent-write and agent-audit
- Update code block syntax to use PowerShell in documentation files
- Simplify audit output templates and enhance prerequisite checks
- Restructure packages — rename csharp→dotnet, merge ag-grid→angular, strip unused domains (#8)
- Remove common package + git-workflow skill (#8)
- Merge duplicate/thin skills, extract inline code blocks (#8)



