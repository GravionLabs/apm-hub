# Angular: Migrate from @draft/development-angular

**Objective**: Consolidate development-angular skills into templates/angular. Extract sakai-ui-specific content to templates/sakai-ui.

## Content Mapping

### Draft Packages
- `draft/development-angular/` → 2 skills
  - development-angular (main skill with 36 references)
  - development-angular-signal-store (NgRx signals specialization)
  - development-angular-update (audit & migration tooling)
- `draft/development-angular-unity/` → Keep in draft (NOT sakai-ui related; unclear purpose)

### Templates Content
- `templates/angular/skills/` → 7 skills
  - angular (empty main skill)
  - angular-developer (50 files with references) ← **MAIN SKILL**
  - angular-testing
  - angular-code-review
  - angular-migration
  - angular-new-app
  - create-angular-project
- `templates/angular/agents/` → 3 agents
  - angular-expert.agent.md
- `templates/angular/instructions/` → 3 files
  - angular.instructions.md
  - ngrx-signals.instructions.md
  - **sakai-ui.instructions.md** ← Move to templates/sakai-ui as foundation

### sakai-ui Content in Angular (to extract)
- `templates/angular/skills/sakai-ui-component/SKILL.md` ← Move to sakai-ui domain
- `templates/angular/instructions/sakai-ui.instructions.md` ← Move to sakai-ui domain
- (Potentially other sakai-ui-specific skills/references)

## Comparison & Action Items

### Skill: development-angular
**Status**: Merge into angular-developer or consolidate

- **Draft SKILL.md**: General guidance (136 lines)
- **Templates angular-developer**: 50 references files (comprehensive reference library)
- **Action**: 
  1. Compare development-angular SKILL.md with templates/angular/skills/angular-developer/SKILL.md
  2. Check if draft references are duplicated in templates
  3. Merge unique content into templates/angular/skills/angular-developer/
  4. Copy missing reference files

### Skill: development-angular-signal-store
**Status**: Likely consolidated or keep as specialized skill

- **Draft**: Specialized NgRx Signal Store guidance
- **Templates**: ngrx-signals.instructions.md exists
- **Action**:
  1. Review for unique NgRx patterns vs templates content
  2. Merge advanced patterns into appropriate skill/instruction
  3. Consider if this should be a separate skill or merged into angular-developer

## Migration Steps

1. **Compare content** (in templates/angular working branch)
   ```bash
   diff -r draft/development-angular/.apm/skills/ templates/angular/skills/
   ```

2. **Identify unique files**
   - Development-angular references vs angular-developer
   - Check which are missing

3. **Merge phase**
   ```bash
   # Copy missing reference files
   cp draft/development-angular/.apm/skills/development-angular/references/*.md \
      templates/angular/skills/angular-developer/references/ 2>/dev/null || true
   ```

4. **Extract sakai-ui content to separate domain**
   ```bash
   # See: templates/sakai-ui/migrate-draft.md for detailed instructions
   ```

5. **Validate & regenerate**
   ```bash
   npm run generate:all
   npm test
   ```

6. **Archive draft**
   - Mark draft/development-angular as deprecated
   - Keep draft/development-angular-unity in draft (purpose unclear)

## Review Checklist

- [ ] All reference files from draft merged or assessed
- [ ] SKILL.md descriptions updated if needed
- [ ] development-angular-signal-store handled (merge or keep)
- [ ] sakai-ui content extracted to templates/sakai-ui
- [ ] Frontmatter standardized
- [ ] Plugin manifests regenerated
- [ ] Tests pass
- [ ] PR links to this migration guide

---

**Related**: DRAFT_MIGRATION_OVERVIEW.md | See also: templates/sakai-ui/migrate-draft.md (sakai-ui extraction)
