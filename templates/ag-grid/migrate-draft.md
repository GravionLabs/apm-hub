# ag-grid: Migrate from @draft/development-ag-grid

**Objective**: Consolidate development-ag-grid from draft into templates.

## Content Mapping

### Draft Package
- `draft/development-ag-grid/` → 1 skill with 14 references
  - development-ag-grid/SKILL.md
  - references: filtering.md, excel-export.md, typescript-generics.md, theming.md, modules.md, column-definitions.md, row-models.md, grid-api-events.md, pivoting.md, row-grouping.md, enterprise-setup.md, cell-rendering.md, cell-editing.md, master-detail.md

### Templates Content
- `templates/ag-grid/skills/` → 18 files
  - (Details: run `find templates/ag-grid/skills -type f | head -20`)

## Comparison & Action Items

### Skill: development-ag-grid
**Status**: Merge into templates/ag-grid

- **Draft**: 1 skill + 14 reference files
- **Templates**: 18 files (likely already comprehensive)
- **Action**:
  1. Run: `diff -r draft/development-ag-grid/.apm/skills/ templates/ag-grid/skills/`
  2. Identify missing reference files
  3. Copy missing files to templates/ag-grid/skills/
  4. Update naming (remove development- prefix if needed)

## Migration Steps

1. **Compare structure**
   ```bash
   find draft/development-ag-grid/.apm/skills -type f
   find templates/ag-grid/skills -type f | head -20
   ```

2. **Identify gaps**
   - Check if all 14 draft references exist in templates
   - Add missing references to templates/ag-grid/skills/

3. **Merge content**
   ```bash
   cp draft/development-ag-grid/.apm/skills/development-ag-grid/references/*.md \
      templates/ag-grid/skills/development-ag-grid/references/ 2>/dev/null || true
   ```

4. **Validate & regenerate**
   ```bash
   npm run generate:all
   npm test
   ```

## Review Checklist

- [ ] All reference files compared
- [ ] Missing files added to templates
- [ ] File names standardized
- [ ] Plugin manifests regenerated
- [ ] Tests pass

---

**Related**: DRAFT_MIGRATION_OVERVIEW.md
