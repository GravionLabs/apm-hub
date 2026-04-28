# Experimental & Unclear Packages Evaluation

Packages in @draft/ marked as experimental or with unclear purpose. Requires team evaluation before templates migration.

## 1. planning2-task-breakdown

**Draft location**: `draft/planning2-task-breakdown/`
**Content**: 1 agent + 1 skill for task breakdown automation

### Content Details
- Agent: `planning2-task-breakdown.agent.md`
- Skill: `planning2-task-breakdown/SKILL.md`

### Evaluation Questions
- [ ] Does this solve a real need in the team's workflow?
- [ ] Is the naming "planning2" stable or should it change?
- [ ] Should this be in templates/shared or a new templates/planning domain?
- [ ] Is the implementation mature enough for templates?

### Decision Options
1. **Promote to templates/shared** - Mature, ready for production use
2. **Keep in draft** - Needs more refinement before promotion
3. **Archive** - Not aligned with current workflows
4. **Create templates/planning** - Promote as new specialized domain

---

## 2. refinement-work-items

**Draft location**: `draft/refinement-work-items/`
**Content**: 1 agent + 1 skill for work item refinement

### Content Details
- Agent: `refinement-work-items.agent.md`
- Skill: `refinement-pbi-quality-guidelines/SKILL.md`

### Evaluation Questions
- [ ] Is this specific to Azure DevOps (links to common-azuredevops) or generic?
- [ ] Should this be part of templates/azuredevops instead?
- [ ] Is the implementation battle-tested?
- [ ] Who uses this, and how often?

### Decision Options
1. **Move to templates/azuredevops** - If Azure DevOps specific
2. **Promote to templates/shared** - If generic work item refinement workflow
3. **Keep in draft** - Needs more validation
4. **Archive** - Not widely used

---

## Recommendation Process

1. **Review** both experimental packages with team
2. **Test** with real workflows to ensure utility
3. **Decide** promotion path for each
4. **Migrate** to appropriate templates domain
5. **Remove** from draft once migrated

---

**For migration guides**: See individual templates/<domain>/migrate-draft.md files.

---

## 3. development-angular-unity

**Draft location**: `draft/development-angular-unity/`
**Status**: UNCLEAR PURPOSE — NOT sakai-ui
**Content**: 1 skill + 11 reference files

### Content Details
- Skill: `development-angular-unity/SKILL.md`
- References: components.md, directives.md, form-validators.md, form-components.md, layout-guidelines.md, services.md, getting-started.md, utils.md, css-variables.md, css-classes.md, form-recipe.md

### Key Issue
This package is **NOT** @gravion/sakai-ui related despite naming similarity to sakai-ui context.
- Templates already has @gravion/sakai-ui content in templates/angular/instructions/sakai-ui.instructions.md
- development-angular-unity content differs from sakai-ui standards
- Purpose and use case unclear

### Evaluation Questions
- [ ] What is "unity" in this context? (UI library? Testing framework? Something else?)
- [ ] Is this project-specific or reusable?
- [ ] Who uses this, and for what?
- [ ] Should this be a separate domain, or is it outdated?

### Decision Options
1. **Promote to templates** - If purpose is clarified and content is mature
2. **Keep in draft** - Pending clarification of purpose (CURRENT: RECOMMENDED)
3. **Archive** - If no longer maintained or used
4. **Merge into angular** - If it's a specialization of Angular, NOT a separate library

---
