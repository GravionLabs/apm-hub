# Changelog

All notable changes to GravionLabs/apm-hub are documented here.
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [2.2.2] — 2026-10-14

### Bug Fixes
- Address review findings for release/next (#255)
- Allow release/next reset in git guardrails (#255)
- Address second review of release/next (#255)
- Speed up trigger eval runner (#221)
- Make trigger eval runner measure installed skills only (#221)
- Address review of trigger evals (#221)
- Address review of trigger evals (#221)
- Address review of orchestrator description input and /orch deprecation (#223)
- Keep escaped pipes inside table cells in the table formatter (#271)
- Repair the agents table in README (#271)
- Run the docs site tests in CI (#271)
- Reject bare .. and cover more link cases in repo-links (#271)
- Check nav links instead of comparing the sidebar to itself (#271)
- Accept digits and uppercase in sidebar link test (#271)
- Parse escaped backslashes and trailing escaped pipes in table rows (#271)
- **ci**: Rebuild before generating docs in the build-test job


### Documentation
- Add public-surface and rename policy (#220)
- Address review of public-surface policy (#220)
- Correct release of the delivery rename (#220)
- Present the orchestrator as the only pipeline, /orch deprecated (#223)
- Add orch-pipeline and /orch to the legacy table, removal in 3.0.0 (#223)
- Document site/ in AGENTS.md and CONTRIBUTING.md (#271)


### Features
- Orchestrator accepts a description and creates the PBI at the plan gate (#223)
- Repo-link markdown-it plugin for the docs site (#271)
- Sidebar list with completeness test for the docs site (#271)
- VitePress config with README as home page (#271)


## [2.2.1] — 2026-10-14

### Bug Fixes
- **hooks**: Stop installing Copilot events into Claude settings (#254)
- **hooks**: Address review findings for hook manifests and Copilot docs (#254)
- **ci**: Authenticate APM installer to avoid GitHub rate limit (#254)


### Documentation
- Document hook events per harness in working-mode (#254)
- Update CHANGELOG.md for v2.2.1 [skip ci]


## [2.2.0] — 2026-10-14

### Bug Fixes
- **development-workflow**: Address review of issue-planning rework (#192)
- **hooks**: Make the ledger hook idempotent against double firing (#180)
- **agents**: Address review of planner agent (#187)
- **agents**: Close gh api write bypasses in planner permissions (#187)
- **agents**: Address review of task breakdown (#189)
- **agents**: Close resume and bug-parent gaps in task breakdown (#189)
- **agents**: Address review of grilling gate (#188)
- **agents**: Harden deferred decisions in grilling gate (#188)
- **agents**: Skip in-flight PBIs in next selection (#190)
- **shared**: Tighten the diagnose skill (#195)
- **agents**: Let the orchestrator resume the implementer with SendMessage
- **hooks**: Replace 'no message' ledger lines and drop orchestrator entries
- **hooks**: Harden ledger summary fallbacks
- **development-workflow**: Tighten the spec dimension reference
- **development-workflow**: Harden the retro metrics script (#197)
- **development-workflow**: Address handoff review findings (#198)
- **hooks**: Close guardrail bypasses found in review (#199)
- **hooks**: Inspect heredoc bodies and harden the guardrail parser (#199)
- **hooks**: Stop running git in foreign repos and inspect piped shells (#199)
- **hooks**: Treat bare repos inside the cwd as foreign (#199)
- Skip merged tasks and cache the tech stack in the orchestrator (#229)
- Address review findings for orchestrator state handling (#229)
- Address round 2 review findings for orchestrator state handling (#229)
- Validate the tech stack cache and guard symlinked cache dirs (#229)
- **agents**: Overview only without issue and description, headless ledger, advisory flow (#230)
- **agents**: Reviewer without package returns [] and fails closed (#233)
- **agents**: Placeholder location for location-less advisories (#233)
- **hooks**: Address review of OpenCode plugin (#182)
- **hooks**: Address review of Copilot context warning (#181)
- **agents**: Run the orchestrator PR phase inline (#235)
- **hooks**: Normalize context-warning thresholds, extend tests and docs (#236)


### Documentation
- Describe the spec review dimension
- **hooks**: Clarify OpenCode plugin install path and apmw status (#184)
- Remove stale no-agents statements (#219) (#244)
- Document apmw sanitize as prerequisite (#224) (#245)
- Update CHANGELOG.md for v2.2.0 [skip ci]


### Features
- **development-workflow**: Hierarchy-aware issue-planning with blocking edges and a plan file (#192)
- **hooks**: Rename claude-hooks to hooks and support Copilot CLI payloads (#180)
- **agents**: Planner agent that writes the plan to a file (#187)
- **agents**: Task breakdown inside a PBI as Task issues linked to commits (#189)
- **agents**: Grill open planning decisions before issues are created (#188)
- **agents**: Plan and next modes for features and epics (#190)
- **shared**: Diagnose skill for bug fixes (#195)
- **agents**: Load diagnose for bug and fix runs (#195)
- **development-workflow**: Spec dimension in review-fanout
- **agents**: Pass the issue number to review-fanout and list spec
- **shared**: Test-quality rules in implementation (#196)
- **development-workflow**: Check test quality in review-fanout tests brief (#196)
- **github**: Task done-when names the interface under test (#196)
- **development-workflow**: Retro skill with run metrics script (#197)
- **development-workflow**: Handoff skill (#198)
- **hooks**: Block destructive git commands (#199)
- **agents**: Orchestrator shows issue overview and review summary (#230)
- **hooks**: OpenCode plugin for the subagent ledger and the context warning (#182)
- **hooks**: Document OpenCode plugin delivery via apm install and apmw sanitize (#184)
- **hooks**: Context warning on Copilot CLI via postToolUse (#181)
- **hooks**: Recommend /clear after planning and validate context-warning thresholds (#236)
- Lighter review-fanout for mechanical changes (#234) (#246)


### Refactoring
- Rename the development-workflow package to delivery (#178)
- **hooks**: Parse context-warning payload with jq or bash scanner, add debug note (#226)


## [2.1.1] — 2026-10-12

### Bug Fixes
- **ng,dotnet**: Address review of external dependencies (#94)
- **skills**: Keep trigger phrases and harden the description budget (#160)
- **shared**: Run detect-techstack without fork (#175) (#177)


### Documentation
- Update CHANGELOG.md for v2.1.1 [skip ci]


### Features
- **ng,dotnet**: Depend on angular/skills and dotnet/skills (#94)


### Refactoring
- **skills**: Cut model-invocable descriptions to 700 tokens total (#160)
- **dotnet**: Remove test duplicates from dotnet-implementation (#163) (#169)
- **ts**: Remove test duplicates from ts-implementation (#164) (#170)
- **py**: Remove test duplicates from py-implementation (#165) (#171)
- **ng**: Reduce test runner line in ng-implementation to a pointer (#166) (#172)


## [2.1.0] — 2026-10-12

### Documentation
- Update CHANGELOG.md for v2.1.0 [skip ci]


## [2.0.0] — 2026-10-12

### Documentation
- One session per issue and headless implement runs (#137)
- Update CHANGELOG.md for v2.0.0 [skip ci]


### Features
- **github**: Cut names the release branch after the real version (#140)
- **ci**: Keep the release PR open and current (#141) (#145)
- **claude-hooks**: Context-size warning hook (#134)
- **agents**: Subagent context rules for all harnesses, lead never as a subagent (#135)


### Refactoring
- **agents**: Rename lead to orchestrator (#150)


## [1.0.24] — 2026-10-12

### Bug Fixes
- **github**: Ignore non-numeric release/* branches in the release-branch resolver (#78) (#79)
- **ci**: Push the release changelog with GH_PAT (#123)


### Documentation
- Extend the skill frontmatter convention with model-invocation and fork keys (#89) (#97)
- Agent frontmatter convention, size validator and generated agent list (#88) (#106)
- Working mode and frameworks overview (#95) (#104)
- Update CHANGELOG.md for v1.2.0
- Update CHANGELOG.md for v1.3.0
- Superpowers decision, borrow not adopt (#119)
- Rename remaining dev-workflow mentions in frameworks.md (#118)
- Update CHANGELOG.md for v1.4.0
- Update CHANGELOG.md for v1.0.24 [skip ci]


### Features
- **github**: Work on release branches by default in the issue, PR and orch skills (#74) (#77)
- Run detect-techstack and verify-project with context: fork (#93)
- **agents**: Add the agents package with explorer, reviewer, implementer and dev-workflow (#86) (#100)
- Delegate exploration and review to the explorer and reviewer agents (#87) (#102)
- **agents**: Implementer report file and status contract (#114)
- **agents**: Review package file for reviewer and review-fanout (#115)
- **agents**: Per-issue ledger for compaction recovery (#116)
- **agents**: Explicit model per dispatch and fix-loop escalation (#117)
- **claude-hooks**: SubagentStop ledger hook as an apm hook primitive (#121)


### Refactoring
- Shorten skill descriptions to at most 40 tokens (#91)
- Shorten skill descriptions to at most 40 tokens (#91) (#99)
- Merge cliff-setup into github-release (#92) (#105)
- **agents**: Rename dev-workflow to lead (#118)


## [1.0.23] — 2026-10-09

### Documentation
- Align documentation with the skills-only repository
- Update CHANGELOG.md for v1.0.23 [skip ci]


## [1.0.22] — 2026-10-09

### Bug Fixes
- Resolve contradictions and broken references across skills
- **github**: Resolve default branch dynamically, review before PR, sync issue templates
- **development-workflow**: Align verify-project with the detect-techstack schema
- **py**: Resolve mocking, asyncio and naming contradictions


### Documentation
- Describe the skills-only repo and align package manifests
- Update CHANGELOG.md for v1.0.22 [skip ci]


### Features
- **development-workflow**: Add orch-pipeline and review-fanout skills with /orch prompt
- **github**: Use native sub-issues instead of markdown checklists
- **apm-tooling**: Add skill-slim skill with skill report script


### Refactoring
- Drop generic-knowledge skills, keep repo rules in <lang>-implementation
- Replace 4 language code-review skills with shared code-review
- **ng**: Split ng-developer, replace vendored references with Angular MCP pointers
- **ng**: Condense ng-ag-grid-developer references
- **github**: Merge batch workflows into one parameterized reference
- Strip boilerplate and trim remaining skills
- **github**: Name branches by conventional-commit type, slim batch-workflow
- ⚠️ **Breaking**: Remove agent infrastructure, keep skills as the only artifact
- **apm-tooling**: Single rules source, slimmer audit and write skills
- **shared**: Slim detect-techstack and check-prerequisites
- **ts**: Script-first create-project, coverage config, prettier/eslint skill moved here
- **dotnet**: Script-first create-solution, remove dotnet-upgrade
- **ng**: Merge ng-developer, ng-library and ag-grid MCP setup into their owners


## [1.0.21] — 2026-07-16

### Documentation
- Document multi-target agent authoring with metadata: blocks
- Update CHANGELOG.md for v1.0.21 [skip ci]


### Features
- Add metadata to agent-strip-fields.json for all platforms
- **dev-workflow**: Move permission block into metadata.opencode
- **dev-workflow**: Add metadata.claude with Claude Code tool names
- **generator**: Implement metadata injection in agent-target-generator


## [1.0.20] — 2026-07-16

### Documentation
- Update CHANGELOG.md for v1.0.20 [skip ci]


## [1.0.19] — 2026-07-15

### Documentation
- Update CHANGELOG.md for v1.0.19 [skip ci]


## [1.0.18] — 2026-07-09

### Bug Fixes
- Rebuild dist before agent-target drift check in CI


### Documentation
- Update CHANGELOG.md for v1.0.18 [skip ci]


### Features
- Give agents a real source of truth and drift-check the deployed copies


## [1.0.17] — 2026-07-07

### Bug Fixes
- Align shared package manifest with actual contents (#56)


### Documentation
- Reposition README and docs for skills-first publishing (#57)
- Update CHANGELOG.md for v1.0.17 [skip ci]


### Refactoring
- Merge ng-testing into ng-test (#54)


## [1.0.16] — 2026-07-07

### Bug Fixes
- Complete apm-install claude target sanitization (#52)


### Documentation
- Update CHANGELOG.md for v1.0.16 [skip ci]


### Features
- Convert implement-workflow agent to a skill (#47)
- Consolidate planning agents into issue-planning skill (#48)
- Convert verify agent to verify-project skill (#49)


### Refactoring
- Convert github-pull-request agent to a skill (#50)
- Slim dev-workflow to the sole skill-orchestrating agent (#51)


## [1.0.15] — 2026-07-07

### Documentation
- Define spec-compliant skill frontmatter convention (#43)
- Update CHANGELOG.md for v1.0.15 [skip ci]


### Refactoring
- Normalize SKILL.md frontmatter to the spec convention (#44)


## [1.0.14] — 2026-07-07

### Documentation
- Update CHANGELOG.md for v1.0.14 [skip ci]


### Features
- Merge epic-implementation into github-issue as a router skill (#40)


### Refactoring
- Remove duplicate github-issue skill from development-workflow (#41)


## [1.0.13] — 2026-06-18

### Bug Fixes
- Add packageManager field to package.json for pnpm/action-setup auto-detection
- Pass explicit pnpm version 11.6.0 to GravionLabs/ci/node actions


### Documentation
- Update CHANGELOG.md for v1.0.13 [skip ci]


### Features
- Add apm-install package — cross-platform uv-managed Python wrapper for apm install with agent frontmatter sanitization
- Per-target strip fields, -p/--platform flag, -g/--global support, apm flag passthrough via parse_known_args
- Add apm-update command, refactor shared run_apm, remove obsolete __main__.py and .cmd
- Add epic and sub-issue support to implement-workflow, implement, github-pull-request agents
- Add sync-opencode skill to apm-tooling for OpenCode frontmatter compat


### Refactoring
- Unify agent frontmatter order, remove comments, shell→execute, add OpenCode fields to implement-workflow


## [1.0.12] — 2026-06-10

### Bug Fixes
- **agents**: Add provider prefix to model field
- **agents**: Add provider prefix to model field
- **agents**: Add provider prefix to model field
- **agents**: Add provider prefix to model field


### Documentation
- Update CHANGELOG.md for v1.0.12 [skip ci]


## [1.0.11] — 2026-06-09

### Bug Fixes
- Remove invalid agents frontmatter, add mode to implement-workflow


### Documentation
- Update CHANGELOG.md for v1.0.11 [skip ci]


## [1.0.10] — 2026-06-09

### Documentation
- Update CHANGELOG.md for v1.0.10 [skip ci]


## [1.0.9] — 2026-06-09

### Bug Fixes
- Update agents to use packageManager instead of build skills (#22)


### Documentation
- Update CHANGELOG.md for v1.0.9 [skip ci]


## [1.0.8] — 2026-06-09

### Bug Fixes
- Update implementation and test skills to use packageManager (#21)
- Merge py-pytest-cov into py-pytest with reference templates
- Merge test-writing skills into registered test skills
- Standardise test naming and categories across dotnet, py, ts


### Documentation
- Update CHANGELOG.md for v1.0.8 [skip ci]


## [1.0.7] — 2026-06-09

### Documentation
- Update CHANGELOG.md for v1.0.7 [skip ci]


### Features
- Assign tiered models to agents based on complexity (#29)
- Add deep-planning and quick-planning agents for tiered planning (#29)


## [1.0.6] — 2026-06-09

### Bug Fixes
- Use concrete skill names in implementation descriptions (#20)


### Documentation
- Update CHANGELOG.md for v1.0.6 [skip ci]


### Features
- Create missing py, ng, and dotnet implementation skills (#20)


## [1.0.5] — 2026-06-09

### Documentation
- Update CHANGELOG.md for v1.0.5 [skip ci]


## [1.0.4] — 2026-06-09

### Bug Fixes
- Update Detect-TechStack.ps1 for recursive scanning and packageManager detection (#18)
- Make packageManager an array, exclude node_modules from scans (#18)
- Increase max depth to 5 for recursive scans (#18)
- Detect slnx files, map languages to skill prefixes (#18)


### Documentation
- Update CHANGELOG.md for v1.0.4 [skip ci]


## [1.0.3] — 2026-06-09

### Documentation
- Update CHANGELOG.md for v1.0.3 [skip ci]


## [1.0.2] — 2026-06-08

### Bug Fixes
- Rename plan agent to planning avoid OpenCode built-in collision (#8)
- Skip puppeteer Chrome download in CI build-test job (#15)
- Update CI to use pnpm with GravionLabs/ci/node composites (#15)
- Remove --if-present from build commands (pnpm doesn't support it)
- Remove deleted packages from all/meta, fix dev-workflow deps format
- Libasound2 -> libasound2t64 for Ubuntu 24.04 Noble
- Allow determine-version on workflow_dispatch so full release pipeline runs


### Documentation
- Update CHANGELOG.md for v1.0.2 [skip ci]


### Features
- Create apm-tooling package with skill lifecycle skills
- Add pnpm-workflow and cliff-setup skills (#15)
- Add detect-techstack, <lang>-build, and <lang>-test skills (#15)


### Refactoring
- Restructure packages — rename csharp→dotnet, merge ag-grid→angular, strip unused domains (#8)
- Remove common package + git-workflow skill (#8)
- Merge duplicate/thin skills, extract inline code blocks (#8)
- Extract planning agent, strip dev-workflow, add modes to opencode-workflow
- Rename dev-workflow → implement-workflow, opencode-workflow → dev-workflow


## [1.0.1] — 2026-05-04

### Documentation
- Update CHANGELOG.md for v1.0.1 [skip ci]


### Refactoring
- Simplify audit output templates and enhance prerequisite checks


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


### Refactoring
- Remove outdated scripts and config files, update sync logic
- Treat plugin agents, instructions, skills as generated artifacts
- Rename list-generator-base.ts to list-generator.ts
- Standardize readonly #field pattern for injected dependencies
- Rename csharp to dotnet, merge ag-grid into angular, rename apm-workspace skills
- Replace docs/model-overview.md refs with local model-selection.md in agent-write and agent-audit
- Update code block syntax to use PowerShell in documentation files



