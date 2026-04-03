# copilot-hub – Roadmap

Shared template library and plugin marketplace for GitHub Copilot.
Plugins bundle agents, skills, instructions, and config files for distribution to any repository.

---

## ✅ Phase 1 – Foundation

- [x] Plugin generator (`src/`) with YAML-based `plugin.config.yml` schema
- [x] Template library: `templates/agents/`, `templates/instructions/`, `templates/prompts/`
- [x] Auto-generated skill directories with `SKILL.md`
- [x] `.github/plugin/plugin.json` marketplace manifest per plugin
- [x] CI pipeline: build, test with coverage, semver versioning, changelog, docs
- [x] Wiki sync via `create-wiki-workflow` skill

---

## ✅ Phase 2 – Core Plugins

### `csharp-development`
- [x] 9 Agents: api-architect, csharp-expert, documentation-writer, dotnet-upgrade, expert-dotnet-software-engineer, modernization, nunit-engineer, openapi-to-application, test-engineer
- [x] 3 Instructions: csharp, csharp-nunit, playwright-dotnet
- [x] 10 Skills: aspnet-minimal-api-openapi, create-dotnet-solution, csharp-async, csharp-code-review, csharp-docs, csharp-mcp-server-generator, csharp-nunit, dotnet-best-practices, dotnet-design-pattern-review, dotnet-upgrade, ef-core, multi-stage-dockerfile, write-tests
- [x] Config file: `.editorconfig` for C# projects

### `angular-development`
- [x] 3 Agents: angular-expert, angular-library-architect, sakai-ui-expert
- [x] 3 Instructions: angular, ngrx-signals, sakai-ui
- [x] 5 Skills: setup-prettier-eslint-husky, angular-component, sakai-ui-component, angular-signal-store, angular-library-create

### `devops`
- [x] 3 Agents: plan, implementation-plan, refine-issue
- [x] 4 Instructions: docker, terraform, shell, markdown
- [x] Skills: create-node-workflow, create-nuget-workflow, create-python-workflow, create-wiki-workflow, add-gitversion, multi-stage-dockerfile, review-ci-workflow

### `security`
- [x] 2 Agents: security-reviewer, se-security-reviewer
- [x] 1 Instruction: security

### `copilot-workspace`
- [x] 3 Skills: gh-copilot-setup, gh-copilot-sync, create-agents-md
- [x] Config scripts: `copilot-sync.ps1`, `New-AgentsMd.ps1`

---

## 🔄 Phase 3 – Python Plugin

Templates for the `python-development` plugin are mostly ready in `templates/`. Missing: a general-purpose Python expert agent.

### New templates needed
- [ ] `templates/agents/python-expert.agent.md` – General Python development agent

### Plugin: `python-development`
- [ ] `plugin.config.yml`
- [ ] Agents: python-expert, pytest-engineer, documentation-writer
- [ ] Instructions: python, python-pytest, playwright-python
- [ ] Skills: create-python-workflow, python-code-review, pytest-coverage, write-tests, multi-stage-dockerfile

---

## 📋 Phase 4 – TypeScript / Node Plugin

Templates partially exist. Core TypeScript instructions and a general TypeScript expert agent are missing.

### New templates needed
- [ ] `templates/instructions/typescript.instructions.md` – TypeScript coding standards (strict types, ESM, modern patterns)
- [ ] `templates/instructions/nodejs.instructions.md` – Node.js conventions (modules, error handling, async patterns)
- [ ] `templates/agents/typescript-expert.agent.md` – General TypeScript/Node development agent
- [ ] `templates/prompts/typescript-code-review.prompt.md` – TypeScript code review prompt

### Plugin: `typescript-node-development`
- [ ] `plugin.config.yml`
- [ ] Agents: typescript-expert, documentation-writer, test-engineer
- [ ] Instructions: typescript, nodejs, playwright-typescript
- [ ] Skills: create-node-workflow, typescript-code-review, setup-prettier-eslint-husky, write-tests, multi-stage-dockerfile

---

## 📋 Phase 5 – Terraform Plugin

`terraform.instructions.md` already exists (also used in `devops` plugin). Dedicated agent and prompts are missing.

### New templates needed
- [ ] `templates/agents/terraform-expert.agent.md` – Terraform IaC specialist (modules, state, providers, security)
- [ ] `templates/prompts/terraform-code-review.prompt.md` – Review a Terraform configuration for best practices and security
- [ ] `templates/prompts/terraform-module-create.prompt.md` – Scaffold a reusable Terraform module

### Plugin: `terraform-development`
- [ ] `plugin.config.yml`
- [ ] Agents: terraform-expert, security-reviewer
- [ ] Instructions: terraform, docker
- [ ] Skills: terraform-code-review, terraform-module-create, multi-stage-dockerfile

---

## 📋 Phase 6 – Helm Plugin

No Helm templates exist yet. Full set of instructions, agent, and prompts needed.

### New templates needed
- [ ] `templates/instructions/helm.instructions.md` – Helm chart conventions (values, templates, helpers, versioning)
- [ ] `templates/agents/helm-expert.agent.md` – Kubernetes packaging specialist (Helm 3, chart design, OCI, Helmfile)
- [ ] `templates/prompts/helm-chart-create.prompt.md` – Scaffold a new Helm chart from scratch
- [ ] `templates/prompts/helm-values-review.prompt.md` – Review `values.yaml` for completeness and security
- [ ] `templates/prompts/helm-chart-upgrade.prompt.md` – Upgrade a Helm chart to a newer chart API version

### Plugin: `helm-development`
- [ ] `plugin.config.yml`
- [ ] Agents: helm-expert, security-reviewer
- [ ] Instructions: helm, docker
- [ ] Skills: helm-chart-create, helm-values-review, helm-chart-upgrade

---

## 📋 Phase 7 – Go Plugin

No Go templates exist yet. Full set of instructions, agent, and prompts needed.

### New templates needed
- [ ] `templates/instructions/go.instructions.md` – Go coding standards (idiomatic Go, error handling, interfaces, modules)
- [ ] `templates/agents/go-expert.agent.md` – Go development specialist (modules, concurrency, testing, toolchain)
- [ ] `templates/prompts/go-code-review.prompt.md` – Review Go code for idiomatic patterns and correctness
- [ ] `templates/prompts/go-test-generate.prompt.md` – Generate table-driven Go tests with coverage

### Plugin: `go-development`
- [ ] `plugin.config.yml`
- [ ] Agents: go-expert, documentation-writer, security-reviewer
- [ ] Instructions: go, docker
- [ ] Skills: go-code-review, go-test-generate, multi-stage-dockerfile, write-tests

---

## 📋 Phase 8 – Generator Enhancements

See [`plans/extend-generator.md`](plans/extend-generator.md) for full spec.

- [ ] External source support (`github://owner/repo:path/to/file[@ref]`) for agents, skills, instructions
- [ ] Fetch external content at generation time; output remains self-contained
- [ ] Support optional `GITHUB_TOKEN` for private repo sources
- [ ] Add resolver unit tests
- [ ] Update generator docs

---

## 📋 Phase 9 – Documentation & Developer Experience

Improve documentation quality, cross-tool clarity, and developer workflow conventions.

### New docs

- [ ] `docs/sync/global-sharing.md` – Guide: when to use `~/.github/` vs `~/.copilot/`, collision rules, Dotfiles-approach, automation via `gh-copilot-setup` and `gh-copilot-sync`

### Concept doc updates

- [ ] `docs/concepts/agents.md` – Add global path `~/.github/agents/` with tool-support matrix
- [ ] `docs/concepts/prompts.md` – Add global path `~/.github/prompts/` with tool-support matrix
- [ ] `docs/concepts/skills.md` – Clarify that skills use `~/.copilot/skills/` (NOT `~/.github/skills/`)
- [ ] `docs/overview.md` – Add cross-reference to `global-sharing.md`

### Templates

- [x] `templates/instructions/issue-workflow.instructions.md` – Instruction for branch + PR conventions
- [ ] `templates/prompts/start-work-on-issue.prompt.md` – Prepare branch and implementation plan
- [ ] `templates/prompts/implement-issue.prompt.md` – Implement code, tests, docs with atomic commits
- [ ] `templates/prompts/finish-work-on-issue.prompt.md` – Review changes and create pull request
- [ ] `templates/prompts/work-on-issue.prompt.md` – Full end-to-end issue workflow

### Generator improvements

- [x] `src/generators/plugin-generator.ts` – Map `tools:` → `allowed-tools:` in SKILL.md (agentskills.io spec)
- [x] Pass through `argument-hint`, `user-invocable`, `disable-model-invocation`, `compatibility` from source to SKILL.md

---

## Architecture

```
copilot-hub/
├── plugins/                    # Generated plugin output
│   ├── csharp-development/     # ✅ Phase 2
│   ├── angular-development/    # ✅ Phase 2
│   ├── devops/                 # ✅ Phase 2
│   ├── security/               # ✅ Phase 2
│   ├── copilot-workspace/      # ✅ Phase 2
│   ├── python-development/     # 🔄 Phase 3
│   ├── typescript-node-development/ # 📋 Phase 4
│   ├── terraform-development/  # 📋 Phase 5
│   ├── helm-development/       # 📋 Phase 6
│   └── go-development/         # 📋 Phase 7
├── templates/
│   ├── agents/                 # Agent markdown templates
│   ├── instructions/           # Instruction markdown templates
│   └── prompts/                # Prompt markdown templates
└── src/                        # Plugin generator (TypeScript)
```
