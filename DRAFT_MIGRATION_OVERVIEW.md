# Draft to Templates Migration Overview

**Status**: Planning phase – detailed migration guides in each `templates/<domain>/migrate-draft.md`

This document maps all packages in `@draft/` to corresponding domains in `@templates/` and summarizes content differences.

## Executive Summary

| Draft Package | Templates Domain | Status | Content Type | Notes |
|---|---|---|---|---|
| development-angular | angular | ✅ Mapped | 2 skills | Consolidate into angular-developer |
| development-angular-unity | (keep draft) | ⚠️ Unclear | 11 skills | NOT sakai-ui; purpose unclear; keep in draft pending evaluation |
| development-ag-grid | ag-grid | ✅ Mapped | 15 skills (1 main) | Minor content additions only |
| development-dotnet-engineer | csharp | ✅ Mapped | 7 agents (0 skills) | Rich agent set; csharp has 23 skills |
| development-pr-review | devops | ✅ Mapped | 4 agents + 1 skill | PR workflow specialists; devops has 12 skills |
| development-workflow | shared | 📋 Core workflow | 2 agents + 1 skill | Merge into templates/shared |
| common-azuredevops | (new) azuredevops | 📋 New domain | 4 agents + 2 instr + 2 skills | Create templates/azuredevops |
| common-git | shared | 📋 Core workflow | 1 skill | Git workflow; belongs in templates/shared |
| common-onboarding | (new) onboarding | 📋 New domain | 1 skill | Create templates/onboarding |
| common-ssdlc | (new) ssdlc | 📋 New domain | 3 skills (1 with PS) | Create templates/ssdlc (DevSecOps focus) |
| planning2-task-breakdown | (experimental) | ⚠️ Experimental | 1 agent + 1 skill | Keep in draft pending evaluation |
| refinement-work-items | (experimental) | ⚠️ Experimental | 1 agent + 1 skill | Keep in draft pending evaluation |

**sakai-ui domain**: Already exists in templates/angular (instructions/sakai-ui.instructions.md, potential skills). Strategy: Extract sakai-ui-specific content from angular → populate templates/sakai-ui as dedicated library domain (see templates/sakai-ui/migrate-draft.md)

## Domains Requiring Action

### 1. **templates/sakai-ui** (Extract from angular, NOT from draft)
- **Existing content**: templates/angular/instructions/sakai-ui.instructions.md
- **Additional content** (if exists): Skills like sakai-ui-component in templates/angular/skills/
- **Strategy**: Extract sakai-ui-specific content from templates/angular → populate templates/sakai-ui
- **Recommendation**: Establish as specialized library domain; separate from Angular framework domain
- **Note**: development-angular-unity in draft is NOT sakai-ui; unclear purpose; keep in draft pending evaluation

### 2. **templates/azuredevops** (from common-azuredevops)
- **Content**: 4 agents, 2 instructions, 2 skills for Azure DevOps integration
- **Categories**: Work item fetching, PBI publishing, PR handling, JSON payloads
- **Recommendation**: Create as dedicated platform integration domain

### 3. **templates/onboarding** (from common-onboarding)
- **Content**: 1 skill for AGENTS.md generation
- **Categories**: Project setup, documentation
- **Recommendation**: Create minimal domain; can be expanded with onboarding workflows

### 4. **templates/ssdlc** (from common-ssdlc)
- **Content**: 3 skills covering SSDLC compliance and CodeQL
- **Categories**: Security, compliance, scanning, suppression
- **Recommendation**: Create as DevSecOps/compliance domain

## Consolidated Domains

### **templates/angular** (development-angular → consolidate)
- **Draft has**: 2 skills (development-angular, development-angular-update/signal-store)
- **Templates has**: 3 agents, 50 skills, 3 instructions (including sakai-ui.instructions.md)
- **Action**: Consolidate draft skills into angular-developer; extract sakai-ui content to templates/sakai-ui
- **Note**: development-angular-unity is NOT sakai-ui and should remain in draft

### **templates/ag-grid** (development-ag-grid → consolidate)
- **Draft has**: 1 skill with 14 reference files
- **Templates has**: 18 skill files
- **Action**: Compare reference content; merge missing references if valuable

### **templates/csharp** (development-dotnet-engineer → consolidate)
- **Draft has**: 7 agents (implement, unit-tests, renovate, package-update, pr-review, engineer, modernize)
- **Templates has**: 9 agents, 23 skills, 3 instructions
- **Action**: Compare agents; add missing dotnet-specific agents if not already covered

### **templates/devops** (development-pr-review → consolidate)
- **Draft has**: 4 agents + 1 skill (all PR review focused)
- **Templates has**: 3 agents, 12 skills, 3 instructions
- **Action**: Compare PR agents; add specialized PR review agents if not duplicated

### **templates/shared** (common-git + development-workflow → consolidate)
- **Draft has**: 1 git workflow skill + 2 general workflow agents
- **Templates has**: 4 agents, 5 skills, 3 instructions
- **Action**: Evaluate workflow content; merge if providing new capabilities

## Content Comparison by Domain

See individual migration guides in each `templates/<domain>/migrate-draft.md` for detailed file-by-file comparisons.

### Key Findings

**High-content domains (potential feature source):**
- `development-angular`: 39 files (mostly references)
- `development-dotnet-engineer`: 7 specialized agents
- `common-azuredevops`: Rich integration with 4 agents

**Low-content domains (quick consolidation):**
- `common-git`: 1 skill
- `common-onboarding`: 1 skill
- `development-workflow`: 3 files total

**Unique content (new domains):**
- `development-angular-unity`: Sakai UI specific (12 files)
- `common-ssdlc`: Compliance/security focus (3 skills)

## Migration Strategy

### Phase 1: Analysis (✅ Complete)
- [x] Map all draft packages to templates domains
- [x] Identify new domains needed
- [x] Document content differences

### Phase 2: Create New Domains
- [ ] Create `templates/sakai-ui/` directory structure
- [ ] Create `templates/azuredevops/` directory structure
- [ ] Create `templates/onboarding/` directory structure
- [ ] Create `templates/ssdlc/` directory structure

### Phase 3: Consolidate Content
- [ ] Copy/merge draft skills into respective templates domains
- [ ] Copy/merge draft agents into respective templates domains
- [ ] Copy/merge draft instructions into respective templates domains
- [ ] Update file names to remove `development-` and `common-` prefixes where appropriate
- [ ] Regenerate plugin manifests: `npm run generate:all`

### Phase 4: Validation & Cleanup
- [ ] Run `npm test` to verify no breakage
- [ ] Archive draft packages or mark as deprecated
- [ ] Update documentation references
- [ ] Create PR with migration

## Next Steps

1. **Review** this overview with team
2. **Read** individual migration guides in `templates/<domain>/migrate-draft.md`
3. **Approve** domain creation and consolidation strategy
4. **Execute** Phase 2-4 migrations

---

**Note**: See corresponding `templates/<domain>/migrate-draft.md` files for detailed step-by-step migration instructions per domain.
