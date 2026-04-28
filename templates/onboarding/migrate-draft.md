# Onboarding: Migrate from @draft/common-onboarding

**Objective**: Create new templates/onboarding domain and migrate common-onboarding content.

**Status**: NEW DOMAIN - Does not exist in templates yet

## Content Mapping

### Draft Package
- `draft/common-onboarding/` → 1 skill
  - common-onboarding-agents-md/SKILL.md (generates AGENTS.md for projects)

## Action Items

### 1. Create Domain Structure
```bash
cd templates
mkdir -p onboarding
mkdir -p onboarding/skills/agents-md
mkdir -p onboarding/instructions
```

### 2. Migrate Skill
```bash
cp draft/common-onboarding/.apm/skills/common-onboarding-agents-md/SKILL.md \
   templates/onboarding/skills/agents-md/SKILL.md
```

### 3. Update Naming
- Rename: `common-onboarding-agents-md` → `agents-md` or `generate-agents-md`
- Update frontmatter `name:` field

### 4. Consider Expansion
This domain can be expanded in the future with:
- Project initialization skills
- Readme generation
- Contributing guidelines generation
- Setup scripts
- CI/CD initialization

## Migration Steps

1. **Create directory structure**
   ```bash
   mkdir -p templates/onboarding/skills/agents-md
   mkdir -p templates/onboarding/instructions
   ```

2. **Copy skill**
   ```bash
   cp draft/common-onboarding/.apm/skills/common-onboarding-agents-md/SKILL.md \
      templates/onboarding/skills/agents-md/SKILL.md
   ```

3. **Update SKILL.md frontmatter**
   - Change: `name: common-onboarding-agents-md` → `name: agents-md`
   - Verify description
   - Check `allowed-tools`

4. **Create plugin.config.yml**
   ```yaml
   name: onboarding
   description: 'Project onboarding and setup automation'
   version: "1.0.0"
   skills:
     - name: agents-md
       source: skills/agents-md/SKILL.md
   ```

5. **Validate & regenerate**
   ```bash
   npm run generate:all
   npm test
   ```

## Review Checklist

- [ ] templates/onboarding/ directory created
- [ ] Skill copied and renamed
- [ ] Frontmatter updated
- [ ] plugin.config.yml created
- [ ] Plugin manifests regenerated
- [ ] Tests pass
- [ ] Future expansion path documented

---

**Related**: DRAFT_MIGRATION_OVERVIEW.md
