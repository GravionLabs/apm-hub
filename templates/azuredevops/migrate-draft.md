# Azure DevOps: Migrate from @draft/common-azuredevops

**Objective**: Create new templates/azuredevops domain and migrate common-azuredevops content.

**Status**: NEW DOMAIN - Does not exist in templates yet

## Content Mapping

### Draft Package
- `draft/common-azuredevops/` → 4 agents + 2 instructions + 2 skills
  - Agents (4):
    - common-azuredevops-work-item-fetch.agent.md
    - common-azuredevops-pbi-publisher.agent.md
    - common-azuredevops-work-item-loader.agent.md
    - common-azuredevops-pull-request.agent.md
  - Instructions (2):
    - azuredevops-mcp.instructions.md
    - azuredevops-context.instructions.md
  - Skills (2):
    - common-azuredevops-pbi-json-payload/SKILL.md
    - common-azuredevops-link-type-resolver/SKILL.md

## Action Items

### 1. Create Domain Structure
```bash
cd templates
mkdir -p azuredevops
mkdir -p azuredevops/agents
mkdir -p azuredevops/skills/pbi-json-payload
mkdir -p azuredevops/skills/link-type-resolver
mkdir -p azuredevops/instructions
```

### 2. Migrate Content
```bash
# Copy agents
cp draft/common-azuredevops/.apm/agents/*.agent.md templates/azuredevops/agents/

# Copy skills
cp draft/common-azuredevops/.apm/skills/common-azuredevops-pbi-json-payload/* \
   templates/azuredevops/skills/pbi-json-payload/

cp draft/common-azuredevops/.apm/skills/common-azuredevops-link-type-resolver/* \
   templates/azuredevops/skills/link-type-resolver/

# Copy instructions
cp draft/common-azuredevops/.apm/instructions/*.instructions.md \
   templates/azuredevops/instructions/
```

### 3. Update Naming
Remove `common-azuredevops-` prefix from:
- Agent file names
- Agent frontmatter `name:` fields
- Skill directory names
- Skill frontmatter `name:` fields

### 4. Create plugin.config.yml
```yaml
name: azuredevops
description: 'Azure DevOps integration for work item management, PRs, and CI/CD workflows'
version: "1.0.0"
agents:
  - source: agents/work-item-fetch.agent.md
  - source: agents/pbi-publisher.agent.md
  - source: agents/work-item-loader.agent.md
  - source: agents/pull-request.agent.md
skills:
  - name: pbi-json-payload
    source: skills/pbi-json-payload/SKILL.md
  - name: link-type-resolver
    source: skills/link-type-resolver/SKILL.md
```

## Migration Steps

1. **Create directory structure**
   ```bash
   mkdir -p templates/azuredevops/{agents,skills,instructions}
   mkdir -p templates/azuredevops/skills/{pbi-json-payload,link-type-resolver}
   ```

2. **Copy content**
   ```bash
   cp draft/common-azuredevops/.apm/agents/*.agent.md templates/azuredevops/agents/
   cp draft/common-azuredevops/.apm/skills/*/SKILL.md templates/azuredevops/skills/
   cp draft/common-azuredevops/.apm/instructions/*.instructions.md templates/azuredevops/instructions/
   ```

3. **Rename files** (remove common-azuredevops- prefix)
   ```bash
   cd templates/azuredevops/agents
   for f in common-azuredevops-*.agent.md; do 
     mv "$f" "${f#common-azuredevops-}"
   done
   ```

4. **Update frontmatter** in all files
   - Remove `common-azuredevops-` prefix from `name:` fields
   - Ensure descriptions are clear
   - Verify `allowed-tools` are appropriate

5. **Create plugin.config.yml**

6. **Validate & regenerate**
   ```bash
   npm run generate:all
   npm test
   ```

## Review Checklist

- [ ] templates/azuredevops/ directory created
- [ ] All 4 agents copied and renamed
- [ ] All 2 skills copied and renamed
- [ ] All 2 instructions copied
- [ ] File names standardized (removed common-azuredevops- prefix)
- [ ] Frontmatter updated
- [ ] plugin.config.yml created
- [ ] Plugin manifests regenerated
- [ ] Tests pass

---

**Related**: DRAFT_MIGRATION_OVERVIEW.md
