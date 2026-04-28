# C#/.NET: Migrate from @draft/development-dotnet-engineer

**Objective**: Consolidate development-dotnet-engineer agents from draft into templates/csharp.

## Content Mapping

### Draft Package
- `draft/development-dotnet-engineer/` → 7 agents
  - development-dotnet-implement.agent.md
  - development-dotnet-unit-tests.agent.md
  - development-dotnet-renovate-merge.agent.md
  - development-dotnet-package-update.agent.md
  - development-dotnet-pr-review-code-reviewer.agent.md
  - development-dotnet-engineer.agent.md (main)
  - development-dotnet-modernize.agent.md

### Templates Content
- `templates/csharp/agents/` → 9 agents
- `templates/csharp/skills/` → 23 skills
- `templates/csharp/instructions/` → 3 files

## Comparison & Action Items

### Agents: development-dotnet-* (7 agents)
**Status**: Merge specialized agents into templates/csharp

These are highly specialized development agents:
- **implement**: General implementation guidance
- **unit-tests**: Testing specialization
- **renovate-merge**: Dependency management
- **package-update**: Package upgrade workflows
- **pr-review-code-reviewer**: Code review specialization
- **engineer**: Main developer role
- **modernize**: Modernization/upgrade guidance

**Action**:
1. Compare draft agents with templates/csharp/agents/
2. Check for duplicate functionality
3. Merge specialized agents if not already covered
4. Copy missing agent definitions

## Migration Steps

1. **List existing agents in templates**
   ```bash
   ls -la templates/csharp/agents/
   ```

2. **Compare agents**
   ```bash
   diff -u draft/development-dotnet-engineer/.apm/agents/ templates/csharp/agents/
   ```

3. **Copy missing agents**
   ```bash
   cp draft/development-dotnet-engineer/.apm/agents/*.agent.md templates/csharp/agents/
   # Remove development-dotnet- prefix in file names and content
   cd templates/csharp/agents
   for f in development-dotnet-*.agent.md; do 
     mv "$f" "${f#development-dotnet-}"
   done
   ```

4. **Update frontmatter** in agent files
   - Remove development- prefixes from names
   - Keep role descriptions intact
   - Ensure consistency with other agents

5. **Validate & regenerate**
   ```bash
   npm run generate:all
   npm test
   ```

## Review Checklist

- [ ] All 7 agents reviewed
- [ ] Duplicates identified and resolved
- [ ] File names standardized (removed development-dotnet- prefix)
- [ ] Frontmatter updated
- [ ] Plugin manifests regenerated
- [ ] Tests pass
- [ ] No regression in existing csharp functionality

---

**Related**: DRAFT_MIGRATION_OVERVIEW.md
