# SSDLC/Security: Migrate from @draft/common-ssdlc

**Objective**: Create new templates/ssdlc domain and migrate common-ssdlc content.

**Status**: NEW DOMAIN - Does not exist in templates yet (but templates/security exists as alternative)

## Decision Point

**Option A**: Create templates/ssdlc for Secure SDLC/compliance focus
**Option B**: Merge into existing templates/security domain

### Content Mapping

### Draft Package
- `draft/common-ssdlc/` → 3 skills
  - common-ssdlc-compliance/SKILL.md (compliance checking)
  - common-ssdlc-compliance/scan-ssdlc.ps1 (PowerShell helper)
  - common-ssdlc-codeql-suppression/SKILL.md (CodeQL suppression)

**Recommendation**: Create templates/ssdlc as separate domain focused on compliance/security workflows
- Keep templates/security for general security best practices
- Use templates/ssdlc for compliance automation and scanning

## Action Items

### 1. Create Domain Structure
```bash
cd templates
mkdir -p ssdlc
mkdir -p ssdlc/skills/compliance
mkdir -p ssdlc/skills/codeql-suppression
mkdir -p ssdlc/instructions
```

### 2. Migrate Skills
```bash
# Copy compliance skill
cp draft/common-ssdlc/.apm/skills/common-ssdlc-compliance/* \
   templates/ssdlc/skills/compliance/

# Copy CodeQL suppression skill
cp draft/common-ssdlc/.apm/skills/common-ssdlc-codeql-suppression/* \
   templates/ssdlc/skills/codeql-suppression/
```

### 3. Update Naming
- `common-ssdlc-compliance` → `compliance`
- `common-ssdlc-codeql-suppression` → `codeql-suppression`

### 4. Create plugin.config.yml
```yaml
name: ssdlc
description: 'Secure SDLC: compliance automation, security scanning, and policy enforcement'
version: "1.0.0"
skills:
  - name: compliance
    source: skills/compliance/SKILL.md
  - name: codeql-suppression
    source: skills/codeql-suppression/SKILL.md
```

## Migration Steps

1. **Create directory structure**
   ```bash
   mkdir -p templates/ssdlc/skills/{compliance,codeql-suppression}
   mkdir -p templates/ssdlc/instructions
   ```

2. **Copy content**
   ```bash
   cp draft/common-ssdlc/.apm/skills/common-ssdlc-compliance/* \
      templates/ssdlc/skills/compliance/

   cp draft/common-ssdlc/.apm/skills/common-ssdlc-codeql-suppression/* \
      templates/ssdlc/skills/codeql-suppression/
   ```

3. **Rename SKILL.md files and update frontmatter**
   - Edit templates/ssdlc/skills/compliance/SKILL.md:
     - Change: `name: common-ssdlc-compliance` → `name: compliance`
   - Edit templates/ssdlc/skills/codeql-suppression/SKILL.md:
     - Change: `name: common-ssdlc-codeql-suppression` → `name: codeql-suppression`

4. **Verify helper scripts**
   - scan-ssdlc.ps1 should be in templates/ssdlc/skills/compliance/
   - Update paths if necessary

5. **Create plugin.config.yml**

6. **Validate & regenerate**
   ```bash
   npm run generate:all
   npm test
   ```

## Review Checklist

- [ ] templates/ssdlc/ directory created
- [ ] Both skills copied and renamed
- [ ] Helper scripts (PowerShell) copied
- [ ] Frontmatter updated
- [ ] plugin.config.yml created
- [ ] Relationship to templates/security documented
- [ ] Plugin manifests regenerated
- [ ] Tests pass

---

**Related**: DRAFT_MIGRATION_OVERVIEW.md | See also: templates/security (alternative)
