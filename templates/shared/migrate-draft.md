# Shared: Migrate from @draft/common-git & @draft/development-workflow

**Objective**: Consolidate git workflow and general workflow content into templates/shared.

## Content Mapping

### Draft Packages
1. **common-git** → 1 skill
   - common-git-workflow/SKILL.md

2. **development-workflow** → 2 agents + 1 skill
   - Agents:
     - development-workflow.agent.md
     - development-software-engineer.agent.md
   - Skill:
     - development-implement-ticket/SKILL.md

### Templates Content
- `templates/shared/agents/` → 4 agents
- `templates/shared/skills/` → 5 skills
- `templates/shared/instructions/` → 3 files

## Comparison & Action Items

### Skill: common-git-workflow
**Status**: Merge into templates/shared/skills

- **Draft**: Git workflow guidance (1 file)
- **Action**: Compare with shared skills; add if unique

### Agents: development-workflow.agent.md & development-software-engineer.agent.md
**Status**: Merge into templates/shared/agents

- **Draft**: General workflow agents
- **Action**: 
  1. Compare with existing shared agents
  2. Merge if providing new workflow orchestration

### Skill: development-implement-ticket
**Status**: Evaluate for merger or new skill

- **Draft**: Ticket implementation guidance
- **Action**: 
  1. Compare with existing shared skills
  2. Merge or create as new skill

## Migration Steps

1. **Compare existing shared agents**
   ```bash
   ls -la templates/shared/agents/
   ```

2. **Copy git workflow**
   ```bash
   cp -r draft/common-git/.apm/skills/common-git-workflow templates/shared/skills/git-workflow
   ```

3. **Copy workflow content**
   ```bash
   cp draft/development-workflow/.apm/agents/*.agent.md templates/shared/agents/
   cp -r draft/development-workflow/.apm/skills/development-implement-ticket templates/shared/skills/implement-ticket
   ```

4. **Update naming** (remove prefixes)
   - development-workflow.agent.md → workflow.agent.md
   - development-software-engineer.agent.md → software-engineer.agent.md
   - development-implement-ticket → implement-ticket

5. **Validate & regenerate**
   ```bash
   npm run generate:all
   npm test
   ```

## Review Checklist

- [ ] All content compared with existing shared domain
- [ ] Duplicates resolved
- [ ] File names standardized
- [ ] Frontmatter updated
- [ ] Plugin manifests regenerated
- [ ] Tests pass

---

**Related**: DRAFT_MIGRATION_OVERVIEW.md
