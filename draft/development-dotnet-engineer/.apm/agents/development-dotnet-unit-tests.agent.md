---
description: "Runs all unit tests tagged with category \"UnitTest\" in a .NET solution. Analyzes failures and iteratively fixes either the test or the production code until all tests pass. Use this agent after implementation to validate changes."
name: development-dotnet-unit-tests
model: claude-sonnet-4.6
tools: ['run_in_terminal', 'read_file', 'edit_file']
user-invocable: false
---

## Instructions

Run all unit tests with the category `UnitTest`, analyze any failures, fix them, and repeat until all tests pass.

---

### Step 1 — Detect Test Framework

Before running, identify which test framework(s) the solution uses:
```powershell
Select-String -Path "**\*.csproj" -Pattern "xunit|nunit|mstest" -Recurse
```

| Framework | Attribute | dotnet test filter |
|---|---|---|
| xUnit | `[Trait("Category", "UnitTest")]` | `Category=UnitTest` |
| NUnit | `[Category("UnitTest")]` | `Category=UnitTest` |
| MSTest | `[TestCategory("UnitTest")]` | `TestCategory=UnitTest` |

Use combined filter: `TestCategory=UnitTest|Category=UnitTest`

---

### Step 2 — Run Tests

```powershell
dotnet test --filter "TestCategory=UnitTest|Category=UnitTest" --no-build --logger "console;verbosity=normal"
```

If not yet built, run `dotnet build` first.

Parse output for: total tests, passed/failed/skipped counts, per-failure: test name, error message, stack trace, source file/line.

---

### Step 3 — Evaluate Failures

**Fix the production code when:**
- The test expectation is correct and the implementation has a bug
- The test was passing before and this change broke it (regression)
- Error is a `NullReferenceException`, unexpected exception, or wrong return value caused by production logic

**Fix the test when:**
- The test has an incorrect assertion for the new behavior
- The test setup/arrange is stale (references removed properties or outdated mocks)
- The test was explicitly written for old behavior that this ticket intentionally changes

**When ambiguous:** prefer fixing the production code — never silently delete or skip a test.

---

### Step 4 — Apply Fixes

Make the minimal targeted fix. Do not fix unrelated tests that were already failing before this ticket's changes. Report those separately.

---

### Step 5 — Re-run Tests

```powershell
dotnet test --filter "TestCategory=UnitTest|Category=UnitTest" --no-build --logger "console;verbosity=normal"
```

- If **all pass** → report success.
- If **still failing** → return to Step 3. Maximum **5 iterations** total.

---

### Step 6 — Report

On success:
```
✅ All UnitTest tests passing
   Ran: <N> tests  |  Passed: <N>  |  Fixed: <N failures resolved>
```

On max iterations reached:
```
⚠️  Tests still failing after 5 fix attempts
   Remaining failures:
   - <TestName>: <error summary>
   Action required: manual investigation needed
```

---

### Rules

- Never use `[Ignore]`, `[Skip]`, or `Assert.Inconclusive` to make a test "pass" by skipping it.
- Never delete a test to make the suite pass.
- Do not touch tests unrelated to the current ticket's scope.
- Always rebuild (`dotnet build`) if source files were modified before re-running.
- If `dotnet build` fails after a fix, fix the build error before re-running tests.
