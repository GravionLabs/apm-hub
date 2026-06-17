# End-to-End (E2E) Testing

Prefer the end-to-end framework that is already configured in the Angular workspace. If the project has no E2E framework and the user wants one added, default to Cypress unless the repo already standardizes on Playwright.

## Running E2E Tests

1. **Prefer the project script if one exists:**

   ```powershell
   npm run e2e
   ```

2. **If the workspace is configured through Angular CLI:**

   ```powershell
   ng e2e
   ```

3. **If the project uses Cypress directly:**

   ```powershell
   npx cypress open
   npx cypress run
   ```

## Test Structure

- **Configuration:** Look for the framework config first, such as `cypress.config.ts` or `playwright.config.ts`.
- **Specs:** Keep E2E specs in the location already used by the project instead of inventing a new layout.
- **Shared helpers:** Put reusable selectors and workflows in test support utilities so specs stay short and readable.

### Example E2E Test Snippet

A typical Cypress test might look like this:

```typescript
// example: cypress/e2e/profile.cy.ts

describe('Profiler', () => {
  beforeEach(() => {
    cy.visit('/profile');
  });

  it('should record and display profiling data', () => {
    cy.get('[data-cy="start-recording"]').click();
    cy.get('[data-cy="profile-card"]').first().click();
    cy.get('[data-cy="stop-recording"]').click();
    cy.get('[data-cy="recording-result"]').should('be.visible');
  });
});
```

### Best Practices

- **Use `data-` attributes:** Whenever possible, use `data-cy` or similar attributes for selecting elements to make tests more resilient to CSS or structural changes.
- **Custom Commands:** Encapsulate common sequences of actions into custom commands in the `support` directory to keep tests clean and readable.
- **Wait for Application State:** Use `cy.wait()` for arbitrary waits sparingly. Prefer to wait for specific UI elements to appear or for network requests to complete to avoid flaky tests.
