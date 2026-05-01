---
name: playwright-cli
description: >
  Use this skill when creating, modifying, or debugging Playwright tests using the Playwright CLI.
  This skill is language-agnostic and works for Angular (TypeScript), .NET, and Python projects.
  Prefer the Playwright CLI over any MCP server because it is more efficient, avoids large snapshots
  in the LLM context, and provides deterministic browser automation.

allowed-tools:
  - read
  - write
  - editFiles
  - search
  - codebase
  - execute
  - runCommands

license: MIT
---

## Overview

`playwright-cli` (`@playwright/cli`) is an AI-agent browser automation tool — distinct from `@playwright/test`.

| Tool | Package | Binary | Purpose |
|------|---------|--------|---------|
| **Agent CLI** | `@playwright/cli` | `playwright-cli` | Browse, interact, explore via snapshot+ref — designed for coding agents |
| **Test Framework** | `@playwright/test` | `npx playwright` | Record tests (`codegen`), run tests, debug, view reports/traces |

Use `playwright-cli` to **explore** the running app and understand its structure. Use `npx playwright` to **record and run** tests.

## When to Use This Skill

Trigger this skill when the user asks to:
- explore a running web app to understand structure and selectors
- interact with a page to verify behavior during test development
- take accessibility snapshots for element refs
- capture screenshots of current page state
- explore Angular Material overlays, dialogs, navigation
- verify login flows by interacting step-by-step
- debug a failing test by re-enacting the flow live

## Decision Flow

1. Determine project type:
   - Angular → look for `angular.json`, `src/app`, `package.json`
   - .NET → look for `.csproj`, `Program.cs`, `appsettings.json`
   - Python → look for `.py` files and `requirements.txt`

2. **Explore the app using `playwright-cli`:**
   ```bash
   playwright-cli open https://app.example.com
   playwright-cli snapshot           # Get accessibility tree with element refs
   playwright-cli screenshot         # Visual verification
   ```

3. **Interact using element refs from snapshot:**
   ```bash
   playwright-cli click e12          # Click element by ref
   playwright-cli fill e34 "user@example.com"
   playwright-cli type "password123"
   playwright-cli press Enter
   playwright-cli snapshot           # Verify new state
   ```

4. **After exploring, generate test code** using `@playwright/test`:
   ```bash
   npx playwright codegen https://app.example.com  # TypeScript/Angular
   playwright codegen https://app.example.com      # after global install
   ```

5. When generating code:
   - Follow the conventions of the detected project type
   - Place tests in the correct folder:
     - Angular: `src/tests/` or `e2e/`
     - .NET: `Tests/Playwright/`
     - Python: `tests/`

6. **Run tests** via the language-specific runner (not `playwright-cli`):
   ```bash
   npx playwright test           # TypeScript/Angular
   dotnet test                   # .NET
   pytest                        # Python
   ```

## Best Practices

- Use `playwright-cli snapshot` after each interaction to get current element refs.
- Always use element refs (`e12`, `e34`) from the latest snapshot — refs change after page updates.
- Prefer `playwright-cli fill <ref> <value>` over `playwright-cli type` for input fields.
- Use `playwright-cli state-save auth.json` to persist session state between explorations.
- Use `playwright-cli tracing-start` before complex flows for later analysis.
- Do not guess refs — always snapshot first.

## Language-Specific Notes

### Angular (TypeScript)
- Tests should live outside the Angular build pipeline.
- Use `@playwright/test` runner, not Protractor.
- Use `data-testid` attributes for stable selectors.

### .NET
- Use `PlaywrightTest` base class when available.
- Use async test methods (`async Task`).
- Run tests with `dotnet test`.

### Python
- Use `pytest` with the `pytest-playwright` plugin.
- Run tests with `pytest`.

## Gotchas

- Do not mix Playwright MCP with `playwright-cli` — use one or the other.
- `playwright-cli` has no `test`, `codegen`, `show-report` or `show-trace` commands — those belong to `@playwright/test`.
- Element refs in snapshots change after page state changes — always re-snapshot before using a ref.
- `playwright-cli` runs a persistent browser daemon — close sessions with `playwright-cli close-all` when done.
- Do not use CSS selectors as refs — `playwright-cli` uses accessibility tree refs (e.g. `e12`).

## References

### Installation

```bash
npm install -g @playwright/cli@latest
playwright-cli --help
playwright-cli install --skills   # Install agent skill files for discovery
```

### playwright-cli Commands (Agent Browser Automation)

| Command | Description |
|---------|-------------|
| `playwright-cli open [url]` | Open browser (optionally navigate to URL) |
| `playwright-cli goto <url>` | Navigate to URL in open session |
| `playwright-cli snapshot` | Get accessibility tree with element refs |
| `playwright-cli screenshot [ref]` | Take screenshot (optionally of element) |
| `playwright-cli click <ref>` | Click element by accessibility ref |
| `playwright-cli dblclick <ref>` | Double-click element |
| `playwright-cli fill <ref> <text>` | Clear and fill input |
| `playwright-cli type <text>` | Type text at current focus |
| `playwright-cli press <key>` | Press keyboard key (e.g. `Enter`, `Tab`) |
| `playwright-cli select <ref> <val>` | Select dropdown option |
| `playwright-cli check <ref>` | Check checkbox |
| `playwright-cli hover <ref>` | Hover over element |
| `playwright-cli state-save [file]` | Save browser storage state |
| `playwright-cli state-load <file>` | Load browser storage state |
| `playwright-cli tracing-start` | Start trace recording |
| `playwright-cli tracing-stop` | Stop trace and save |
| `playwright-cli console` | View console messages |
| `playwright-cli network` | View network requests |
| `playwright-cli close` | Close current browser session |

### @playwright/test Commands (Test Runner)

| Command | Description |
|---------|-------------|
| `npx playwright codegen <url>` | Record test by clicking on page |
| `npx playwright test` | Run all tests |
| `npx playwright test --debug` | Run with inspector open |
| `npx playwright test --ui` | Run with interactive UI mode |
| `npx playwright show-report` | View HTML test report |
| `npx playwright show-trace <trace.zip>` | View trace from failed test |
| `npx playwright install` | Install browser binaries |

### Documentation

- [Playwright Agent CLI](https://playwright.dev/agent-cli/introduction)
- [Playwright Test Framework](https://playwright.dev/docs/intro)
- [Codegen Guide](https://playwright.dev/docs/codegen)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [Trace Viewer](https://playwright.dev/docs/trace-viewer)
