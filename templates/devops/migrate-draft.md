# DevOps: Migrate from @draft/development-pr-review

**Objective**: Consolidate development-pr-review agents and skills into templates/devops.

## Content Mapping

### Draft Package
- `draft/development-pr-review/` → 4 agents + 1 skill
  - Agents:
    - development-pr-reviewer.agent.md
    - development-pr-review-comment-poster.agent.md
    - development-pr-review-approval-vote.agent.md
    - development-pr-review-diff-fetcher.agent.md
  - Skill:
    - development-review-pr/SKILL.md

### Templates Content
- `templates/devops/agents/` → 3 agents
- `templates/devops/skills/` → 12 skills
- `templates/devops/instructions/` → 3 files

## Comparison & Action Items

### Agents: development-pr-review-* (4 agents)
**Status**: Merge PR review agents into templates/devops

Specialized PR review workflow agents:
- **reviewer**: Main PR review orchestrator
- **comment-poster**: Comment automation
- **approval-vote**: Approval workflow
- **diff-fetcher**: Diff retrieval

**Action**:
1. Compare with existing templates/devops/agents
2. Identify if these should be merged as specialized roles
3. Copy missing agents

### Skill: development-review-pr
**Status**: Merge into templates/devops/skills

**Action**:
1. Compare with existing devops skills
2. Check if PR review workflow is covered
3. Merge if unique

## Migration Steps

1. **Compare agents**
   ```bash
   diff -r draft/development-pr-review/.apm/agents/ templates/devops/agents/
   ```

2. **Copy PR review agents**
   ```bash
   cp draft/development-pr-review/.apm/agents/*.agent.md templates/devops/agents/
   # Remove development-pr-review- prefix
   ```

3. **Copy PR review skill**
   ```bash
   cp -r draft/development-pr-review/.apm/skills/development-review-pr templates/devops/skills/review-pr
   ```

4. **Update naming** (remove prefixes)
   - development-pr-reviewer.agent.md → pr-reviewer.agent.md
   - development-pr-review-comment-poster.agent.md → pr-comment-poster.agent.md
   - etc.

5. **Validate & regenerate**
   ```bash
   npm run generate:all
   npm test
   ```

## Review Checklist

- [ ] All 4 agents reviewed and compared
- [ ] Skill content reviewed
- [ ] Duplicates identified
- [ ] File names standardized
- [ ] Plugin manifests regenerated
- [ ] Tests pass
- [ ] PR workflow integration verified

---

**Related**: DRAFT_MIGRATION_OVERVIEW.md
