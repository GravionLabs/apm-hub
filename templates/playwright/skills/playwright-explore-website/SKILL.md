---
name: playwright-explore-website
description: 'Explore a website with Playwright MCP to identify key user flows, UI elements, and locators for testing. Returns a structured exploration report with proposed test cases.'
allowed-tools: fetch runCommands playwright
model: claude-sonnet-4.6
---

Explore a website to discover testable flows and identify correct locators.

## Stack
- **CLI:** `npx playwright test --ui`, `npx playwright codegen <url>`
- **MCP:** Playwright MCP (live browser snapshot and navigation)

## Steps
1. Ask for the URL if not provided
2. Navigate using Playwright MCP
3. Identify and interact with 3–5 core user flows (navigation, forms, dynamic content)
4. For each flow: record locators, expected states, and test boundaries
5. Close browser context after exploration
6. Output a structured report (see format below)

## Locator discovery rules
- Prefer `getByRole`, `getByTestId`, `getByLabel`, `getByText`
- Avoid CSS selectors with dynamically generated class names
- Note any missing `data-testid` attributes — flag them for the dev team

## Exploration report format
```
## Explored: <URL>

### Flow 1: <name>
- Entry: <locator/action>
- Steps: [step1, step2, ...]
- Expected outcome: <assertion>
- Locators found: { <element>: <locator> }

### Proposed test cases
1. <test description>
2. <test description>
```
