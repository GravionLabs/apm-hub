### ✅ Summary
Agent `{name}` audited. Status: ✅ PASS ({N} checks passed, 0 findings) or
⚠️ FINDINGS ({N} critical, {M} important, {X} suggestions).

### 📝 What Changed
- Report: `{agent-path}/audit-report.json` (created/updated)
- Fixes applied: {Y/N} ({list of categories if Y})

### ✔️ Verify
```powershell
# Check audit report exists
Test-Path "{agent-path}/audit-report.json"

# View findings
Get-Content "{agent-path}/audit-report.json" | ConvertFrom-Json | Select-Object findings
```

Re-run the audit with `@agent-audit {agent-path}` after fixes are applied to
confirm the result.

### 🚀 Next Steps
1. If PASS: Agent is production-ready ✅
2. If findings: Review the detailed report and decide whether to auto-fix or investigate manually
3. If auto-fixed: Re-audit to confirm
4. Commit fixes and push to PR
