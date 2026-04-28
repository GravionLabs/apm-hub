# Draft to Templates Migration Checklist

✅ **Phase 1 & 2: Analysis & Documentation** — COMPLETE

All comparison matrices and domain-specific migration guides have been generated.

## Generated Documentation

### Main Overview Document
- **`DRAFT_MIGRATION_OVERVIEW.md`** (repo root)
  - Executive summary of all draft packages
  - Mapping to templates domains
  - New domains to create (sakai-ui, azuredevops, onboarding, ssdlc)
  - Content comparison summary

### Domain-Specific Migration Guides

**Consolidation (merge into existing templates domain):**
1. **`templates/angular/migrate-draft.md`**
   - Consolidates: development-angular, development-angular-update, development-angular-signal-store
   - Extracts to sakai-ui: sakai-ui.instructions.md, sakai-ui-component (if exists)
   - Action: Merge skills into angular-developer; separate sakai-ui content

2. **`templates/ag-grid/migrate-draft.md`**
   - Consolidates: development-ag-grid (14 references)
   - Action: Compare references; merge missing files

3. **`templates/csharp/migrate-draft.md`**
   - Consolidates: development-dotnet-engineer (7 agents)
   - Action: Copy specialized agents; ensure no duplication

4. **`templates/devops/migrate-draft.md`**
   - Consolidates: development-pr-review (4 agents + 1 skill)
   - Action: Merge PR review workflow agents

5. **`templates/shared/migrate-draft.md`**
   - Consolidates: common-git (1 skill), development-workflow (2 agents + 1 skill)
   - Action: Merge workflow orchestration content

**Populate Existing Domain:**
6. **`templates/sakai-ui/migrate-draft.md`** (REVISED)
   - Source: Extract from templates/angular (NOT from draft)
   - Extract: sakai-ui.instructions.md, sakai-ui-component (if exists)
   - Action: Move sakai-ui content from angular to sakai-ui; establish as separate library domain

**Create New Domains:**
7. **`templates/azuredevops/migrate-draft.md`** (NEW)
   - Source: common-azuredevops (4 agents + 2 instructions + 2 skills)
   - Azure DevOps platform integration
   - Create directory + copy content + create plugin.config.yml

8. **`templates/onboarding/migrate-draft.md`** (NEW)
   - Source: common-onboarding (1 skill)
   - Project onboarding/setup automation
   - Create minimal domain; expandable for future

9. **`templates/ssdlc/migrate-draft.md`** (NEW)
   - Source: common-ssdlc (3 skills)
   - Secure SDLC / compliance automation
   - Create domain; separate from templates/security

**Experimental (requires team evaluation):**
10. **`templates/shared/EXPERIMENTAL_PACKAGES.md`**
    - planning2-task-breakdown (1 agent + 1 skill)
    - refinement-work-items (1 agent + 1 skill)
    - Decision matrix per package
    - Promotion path per package

## How to Use These Documents

### For Teams/Stakeholders
1. Start with **`DRAFT_MIGRATION_OVERVIEW.md`** for high-level overview
2. Review **`templates/shared/EXPERIMENTAL_PACKAGES.md`** to decide on experimental packages
3. Approve/adjust strategy before proceeding

### For Developers (Implementation)
1. Read **`DRAFT_MIGRATION_OVERVIEW.md`** for context
2. For each domain, follow steps in **`templates/<domain>/migrate-draft.md`**
3. Execute migration steps in suggested order:
   - Phase 2a: Create new domains (sakai-ui, azuredevops, onboarding, ssdlc)
   - Phase 2b: Consolidate content into existing domains (angular, ag-grid, csharp, devops, shared)
4. Run `npm run generate:all && npm test` to regenerate + validate
5. Create PR linking this migration checklist

## Next Actions

### Decision Required (Block Migration)
- [ ] Team review of DRAFT_MIGRATION_OVERVIEW.md
- [ ] Approval for new domain creation
- [ ] Evaluation of experimental packages (planning2, refinement)

### Phase 3: Create New Domains
- [ ] Create templates/azuredevops/ directory structure
- [ ] Create templates/onboarding/ directory structure
- [ ] Create templates/ssdlc/ directory structure
- [ ] (sakai-ui: Already exists, will be populated in Phase 4)

### Phase 4: Extract & Consolidate Content
- [ ] Extract sakai-ui content from angular (sakai-ui.instructions.md, skills)
- [ ] Move sakai-ui content to templates/sakai-ui
- [ ] Consolidate angular content (development-angular, signal-store)
- [ ] Consolidate ag-grid content
- [ ] Consolidate csharp content (dotnet agents)
- [ ] Consolidate devops content (pr-review)
- [ ] Consolidate shared content (git + workflow)

### Phase 5: Validate & Cleanup
- [ ] Run: `npm run generate:all`
- [ ] Run: `npm test`
- [ ] Verify no build/test failures
- [ ] Archive draft packages or mark as deprecated
- [ ] Update CHANGELOG.md
- [ ] Create PR with migration

## File Structure After Migration

```
templates/
├── ag-grid/
│   ├── skills/
│   │   ├── development-ag-grid/  (consolidated)
│   │   └── ... (existing skills)
│   └── migrate-draft.md
├── angular/
│   ├── skills/
│   │   ├── angular-developer/  (consolidated from development-angular)
│   │   └── ... (existing skills)
│   ├── instructions/
│   │   ├── angular.instructions.md
│   │   ├── ngrx-signals.instructions.md
│   │   └── (sakai-ui.instructions.md moved to sakai-ui)
│   └── migrate-draft.md
├── azuredevops/  (NEW)
│   ├── agents/  (4 from common-azuredevops)
│   ├── skills/  (2 from common-azuredevops)
│   ├── instructions/  (2 from common-azuredevops)
│   ├── plugin.config.yml
│   └── migrate-draft.md
├── csharp/
│   ├── agents/  (consolidated from development-dotnet-engineer)
│   └── migrate-draft.md
├── devops/
│   ├── agents/  (consolidated from development-pr-review)
│   ├── skills/  (consolidated from development-pr-review)
│   └── migrate-draft.md
├── onboarding/  (NEW)
│   ├── skills/
│   │   └── agents-md/  (from common-onboarding)
│   ├── plugin.config.yml
│   └── migrate-draft.md
├── sakai-ui/  (POPULATE, don't create)
│   ├── skills/  (extract from angular if exists)
│   │   └── sakai-ui-component/
│   ├── instructions/  (extract from angular)
│   │   └── sakai-ui.instructions.md
│   ├── plugin.config.yml
│   └── migrate-draft.md
├── shared/
│   ├── agents/  (consolidated from development-workflow)
│   ├── skills/  (consolidated from common-git + development-workflow)
│   ├── EXPERIMENTAL_PACKAGES.md
│   └── migrate-draft.md
├── ssdlc/  (NEW)
│   ├── skills/  (2 from common-ssdlc)
│   ├── plugin.config.yml
│   └── migrate-draft.md
└── ... (other unchanged domains)

draft/
├── common-azuredevops/  (ARCHIVED after migration)
├── common-git/  (ARCHIVED after migration)
├── common-onboarding/  (ARCHIVED after migration)
├── common-ssdlc/  (ARCHIVED after migration)
├── development-ag-grid/  (ARCHIVED after migration)
├── development-angular/  (ARCHIVED after migration)
├── development-angular-unity/  (KEEP — purpose unclear, not sakai-ui)
├── development-dotnet-engineer/  (ARCHIVED after migration)
├── development-pr-review/  (ARCHIVED after migration)
├── development-workflow/  (ARCHIVED after migration)
├── planning2-task-breakdown/  (KEEP pending evaluation)
└── refinement-work-items/  (KEEP pending evaluation)
```

## Summary Statistics (UPDATED)

| Category | Count | Details |
|---|---|---|
| Domains to consolidate | 5 | angular, ag-grid, csharp, devops, shared |
| New domains to create | 3 | azuredevops, onboarding, ssdlc |
| Existing domain to populate | 1 | sakai-ui (extract from angular) |
| Experimental packages | 2 | planning2, refinement (keep in draft) |
| Keep in draft (unclear) | 1 | development-angular-unity (NOT sakai-ui) |
| Total agents to migrate | 18+ | From draft packages |
| Total skills to migrate | 15+ | From draft packages |
| Total files to migrate | 80+ | All assets, references, helpers |

---

**Start with**: DRAFT_MIGRATION_OVERVIEW.md

**Detailed steps**: templates/<domain>/migrate-draft.md (per domain)

**Questions about experimental packages**: templates/shared/EXPERIMENTAL_PACKAGES.md
