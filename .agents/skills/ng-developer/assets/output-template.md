### ✅ Summary
{Task} completed for Angular project v{version}. {Artifact count} artifacts generated (components, services, tests, config changes).

### 📝 What Changed
- **Project:** {path} (created/updated)
- **Generated artifacts:** {list with types}
  - Components: {count} ({files})
  - Services: {count} ({files})
  - Tests: {count} ({files})
  - Configuration: {files} (if modified)
- **Build status:** ✅ PASS
- **Test status:** ✅ All passing / ⚠️ {X} failing

### ✔️ Verify
```powershell
# Verify generation
ng version
ng build
npm --silent run test

# Verify artifacts exist
Get-ChildItem src/app -Recurse | Select-Object FullName
```

### 🚀 Next Steps
1. Review generated code against the Angular style guide
2. Add additional components or services as needed
3. Implement routing if it is still pending
4. Add tests for any manual code
5. Integrate the changes into the build or deployment pipeline
