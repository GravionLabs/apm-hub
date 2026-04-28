# Sakai UI: Extract from @templates/angular into templates/sakai-ui

**Objective**: Establish templates/sakai-ui as dedicated domain for @gravion/sakai-ui library development by extracting sakai-ui-specific content from templates/angular.

**Status**: templates/sakai-ui exists (mostly empty) — populate with angular-extracted content

## Rationale

- templates/angular/instructions/sakai-ui.instructions.md exists with sakai-ui standards
- templates/angular/skills may contain sakai-ui-specific skills (e.g., sakai-ui-component)
- Keep templates/angular focused on Angular framework best practices
- Establish templates/sakai-ui as specialized library domain for @gravion/sakai-ui development
- development-angular-unity (draft) is NOT sakai-ui — unclear purpose, keep in draft

## Content to Extract from templates/angular

### Instructions
- `templates/angular/instructions/sakai-ui.instructions.md`
  - @gravion/sakai-ui coding standards, library structure, exports

### Skills (if they exist)
- `templates/angular/skills/sakai-ui-component/` (check if exists)
- Any other sakai-ui-specific skills in angular domain

### Agents (if they exist)
- Check for sakai-ui-specific agents in templates/angular/agents/

## Migration Steps

1. **Audit current sakai-ui content in angular**
   ```bash
   ls -la templates/angular/skills/ | grep sakai
   ls -la templates/angular/instructions/ | grep sakai
   find templates/angular -name "*sakai*" -type f
   ```

2. **Create sakai-ui domain structure** (if not already done)
   ```bash
   mkdir -p templates/sakai-ui/skills
   mkdir -p templates/sakai-ui/instructions
   mkdir -p templates/sakai-ui/agents
   ```

3. **Move sakai-ui instructions from angular to sakai-ui**
   ```bash
   cp templates/angular/instructions/sakai-ui.instructions.md \
      templates/sakai-ui/instructions/sakai-ui.instructions.md
   ```

4. **Move sakai-ui skills from angular to sakai-ui** (if they exist)
   ```bash
   # Example (if sakai-ui-component exists):
   cp -r templates/angular/skills/sakai-ui-component \
      templates/sakai-ui/skills/sakai-ui-component
   ```

5. **Move sakai-ui agents from angular to sakai-ui** (if they exist)
   ```bash
   # Example (copy any sakai-ui agents):
   cp templates/angular/agents/*sakai-ui* templates/sakai-ui/agents/ 2>/dev/null || true
   ```

6. **Create plugin.config.yml for sakai-ui**
   ```yaml
   name: sakai-ui
   description: '@gravion/sakai-ui Angular component library development'
   version: "1.0.0"
   instructions:
     - source: instructions/sakai-ui.instructions.md
   skills:
     - name: sakai-ui-component
       source: skills/sakai-ui-component/SKILL.md  # if it exists
   ```

7. **Update angular domain**
   - Remove sakai-ui.instructions.md from templates/angular/instructions/
   - Remove any sakai-ui-specific skills from templates/angular/skills/
   - Ensure angular domain focuses on framework, not library specifics

8. **Validate & regenerate**
   ```bash
   npm run generate:all
   npm test
   ```

## Decision on development-angular-unity

**Status**: KEEP IN DRAFT (not sakai-ui related)
- Do not move development-angular-unity to sakai-ui
- Content differs from @gravion/sakai-ui library standards
- Purpose unclear — pending team evaluation
- Consider: Is it a separate Angular UI library? Different from sakai?

## Review Checklist

- [ ] Audit completed: Found all sakai-ui content in angular
- [ ] templates/sakai-ui directory structure created
- [ ] sakai-ui.instructions.md moved to sakai-ui domain
- [ ] sakai-ui skills moved to sakai-ui domain (if any)
- [ ] sakai-ui agents moved to sakai-ui domain (if any)
- [ ] plugin.config.yml created
- [ ] angular domain cleaned up (sakai-ui content removed)
- [ ] Plugin manifests regenerated
- [ ] Tests pass
- [ ] development-angular-unity remains in draft

---

**Related**: DRAFT_MIGRATION_OVERVIEW.md | See also: templates/angular/migrate-draft.md (angular consolidation)
