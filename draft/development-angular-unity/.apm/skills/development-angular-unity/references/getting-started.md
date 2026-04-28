# Getting Started with RWE Unity

Complete guide covering access, installation, integration, configuration, and initial app frame setup.

Source: https://unity.rwe.com/intro/getting-started/

---

## 1. Get Access to the Unity npm Package

Unity is published to a private npm registry. Choose one of the two options below.

### Option 1: JFrog (recommended)

1. Navigate to https://rwest.jfrog.io/ and log in via the **SAML SSO** button.
2. Click the user icon (top-right) > **Set me up**.
3. Select **npm**, search for `unity`, and choose **mtiae-unity-npm-virtual**.
4. Click **Generate Token & Create Instructions**.
5. Scroll to _Edit .npmrc (Scoped)_ and copy the snippet into your **user-level** `.npmrc` (`%USERPROFILE%/.npmrc`).

**Project `.npmrc`** — add the scoped registry so only `@rwe/*` packages resolve from JFrog:

```ini
registry=https://registry.npmjs.org/
@rwe:registry=https://rwest.jfrog.io/artifactory/api/npm/mtiae-unity-npm-virtual/
ignore-scripts=true
```

### Option 2: Azure DevOps Feed

Use this when your organisation cannot access the JFrog feed directly.

#### Create a feed in your organisation

```
Artifacts -> Create Feed -> Scope (Organization) -> Create
Feed settings -> Upstream sources -> Add upstream source -> Feed in another organization
  Package type = npm
  Locator     = azure-feed://RWEST-MFI-AE/Unity/unity-restore@Local
```

#### Generate a Personal Access Token (PAT)

1. Open Azure DevOps > User Settings (top-right) > **Personal access tokens**.
2. Click **New Token** — ensure at least **Packaging (Read)** rights.
3. Click **Create** and save the token.

#### Configure local connection

1. Open your Azure project > **Artifacts** > select the created feed.
2. Click **Connect to Feed** > **npm** and follow the instructions.
3. Run `npx better-vsts-npm-auth` from the project root to generate the `.npmrc`.

---

## 2. Install Dependencies

### Prerequisites

```powershell
# Angular Material v21+ is required
npm install @angular/material@^21

# i18n support (peer dependency of @rwe/unity-lib)
npm install @ngx-translate/core@^16 @ngx-translate/http-loader@^16

# Material icons font
npm install material-icons@^1.13
```

### Install Unity

```powershell
npm install @rwe/unity-lib
```

**Current version:** `21.4.2`

---

## 3. Integration — angular.json Configuration

### Assets

Add Unity assets to the `architect > build > options > assets` array:

```json
{
  "glob": "**/*",
  "input": "node_modules/@rwe/unity-lib/src/assets/",
  "output": "/assets/"
}
```

### Styles

Add the Unity theming stylesheet **before** your application styles:

```json
["node_modules/@rwe/unity-lib/rwe.ui.theming.scss", "src/styles.scss"]
```

### Bootstrap Configuration

```typescript
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { provideZonelessChangeDetection } from "@angular/core";
import { provideRouter, withComponentInputBinding } from "@angular/router";
import { provideUnityLib, RweLogLevels, UnityNgLocale } from "@rwe/unity-lib/core";
import { provideRweTranslations } from "@rwe/unity-lib/loca";

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    provideZonelessChangeDetection(),
    provideUnityLib({
      logLevel: RweLogLevels.Debug,
      handleLocaleInit: true,
      title: "My Application",
      locales: [UnityNgLocale.enGB, UnityNgLocale.enUS, UnityNgLocale.deDE],
      setLanguageFromBrowserSettings: true,
      localStorageCacheKey: "my-app",
      localStorageCacheVersion: 1,
    }),
    provideRweTranslations({ localeDefault: UnityNgLocale.enGB }),
    provideRouter([...], withComponentInputBinding()),
  ],
});
```

### Configuration Options (`RweUnityLibModuleCfg`)

| Option                           | Type                         | Default      | Description                                |
| -------------------------------- | ---------------------------- | ------------ | ------------------------------------------ |
| `actionSlotsMinWidth`            | `string`                     | `unset`      | Minimum width for action slot bar          |
| `dateSelectFirstDayOfWeek`       | `number`                     | `0` (Sunday) | First day of week in datepickers           |
| `defaultTheme`                   | `RweUnityThemeModes`         | `Light`      | Default theme (Light/Dark/Contrast)        |
| `disableTooltipInteractivity`    | `boolean`                    | `true`       | Disable tooltip mouse interaction          |
| `formSelectPanelWidth`           | `TypeFormSelectPanelWidth`   | `'auto'`     | Default select dropdown width              |
| `handleLocaleInit`               | `boolean`                    | `false`      | Unity manages locale loading               |
| `handleSpecialHttpErrors`        | `string`                     | `'handle'`   | Intercept HTML error responses             |
| `locale`                         | `string`                     | —            | Force LOCALE_ID (needs `handleLocaleInit`) |
| `locales`                        | `UnityNgLocale[]`            | —            | Available languages for language menu      |
| `localStorageCacheKey`           | `string`                     | —            | localStorage key for cache                 |
| `localStorageCacheVersion`       | `number`                     | —            | Bump on schema changes to invalidate       |
| `localStorageLanguageKey`        | `string`                     | —            | localStorage key for lang persistence      |
| `logLevel`                       | `RweLogLevels`               | `Error`      | Console verbosity                          |
| `maxLastUsedItems`               | `number`                     | `10`         | Max last-used-menu entries                 |
| `notificationTopMargin`          | `string`                     | `'3.5rem'`   | Top margin for toast notifications         |
| `setLanguageFromBrowserSettings` | `boolean`                    | —            | Auto-detect language from browser          |
| `showLoaderOnRequests`           | `boolean`                    | `true`       | Loader on HTTP requests                    |
| `showLoaderOnRouting`            | `boolean`                    | `true`       | Loader on route transitions                |
| `title`                          | `string`                     | —            | Default page title                         |
| `translationMap`                 | `Partial<RweTranslationMap>` | —            | Override library translation keys          |

---

## 4. Application Frame Setup

The application frame structures the typical app shell layout with header, sidebars, main, and footer.

### Minimal App Frame

```html
<rwe-application-frame>
  <rwe-header>
    <rwe-right>
      <rwe-theme-menu />
    </rwe-right>
  </rwe-header>
  <rwe-main>
    <router-outlet />
  </rwe-main>
  <rwe-footer />
</rwe-application-frame>
```

### Full App Frame

```html
<rwe-application-frame>
  <rwe-header>
    <rwe-left>
      <rwe-nav-bar [routes]="navRoutes" />
    </rwe-left>
    <rwe-center>
      <rwe-app-logo
        darkSrc="assets/logo-dark.svg"
        lightSrc="assets/logo-light.svg"
      />
    </rwe-center>
    <rwe-right>
      <rwe-language-menu />
      <rwe-theme-menu />
      <rwe-user [showLogout]="true" (logout)="onLogout()" />
      <rwe-app-menu [apps]="environments" />
    </rwe-right>
  </rwe-header>

  <rwe-aside-left mode="side" [opened]="true">
    <rwe-navigation [routes]="sideNavRoutes" type="extended" />
  </rwe-aside-left>

  <rwe-main [withPadding]="true">
    <router-outlet />
  </rwe-main>

  <rwe-footer
    [appVersion]="'1.0.0'"
    [environment]="'Production'"
    [showApiVersion]="true"
    [routes]="footerLinks"
  />
</rwe-application-frame>
```

```typescript
import { RweApplicationFrame, RweHeader, RweMain, RweFooter, RweAsideLeft } from "@rwe/unity-lib/application-frame";
import { RweNavBar } from "@rwe/unity-lib/nav-bar";
import { RweNavigation } from "@rwe/unity-lib/navigation";
import { RweAppLogo } from "@rwe/unity-lib/app-logo";
import { RweThemeMenu } from "@rwe/unity-lib/theme-menu";
import { RweLanguageMenu } from "@rwe/unity-lib/language-menu";
import { RweAppMenu } from "@rwe/unity-lib/app-menu";
import { RweUser } from "@rwe/unity-lib/user";

@Component({
  imports: [
    RweApplicationFrame, RweHeader, RweMain, RweFooter, RweAsideLeft,
    RweNavBar, RweNavigation, RweAppLogo, RweThemeMenu, RweLanguageMenu,
    RweAppMenu, RweUser, RouterOutlet,
  ],
  // ...
})
```

---

## 5. Translation Setup (Optional)

If your app uses i18n via `@ngx-translate`:

```typescript
bootstrapApplication(AppComponent, {
  providers: [provideRweTranslations({ localeDefault: UnityNgLocale.enGB })],
});
```

The `provideRweTranslations()` function:

- Integrates `@ngx-translate/core` with Unity
- Loads JSON translation files from `./assets/i18n/{locale}.json`
- Provides the `RweDiTranslate` injection token for programmatic translations

### Translation in Components

```typescript
import { RweDiTranslate } from "@rwe/unity-lib/core";

export class MyComponent {
  readonly #t = inject(RweDiTranslate);

  greeting = computed(() => this.#t("hello.world", { name: "User" }));
}
```

### Translation Extraction

Use the built-in CLI tool to extract translation keys:

```powershell
npx unity-extract-loca
```

---

## 6. Linting Setup (Optional)

### ESLint

```powershell
npm install @rwe/unity-eslint-config --save-dev
```

```typescript
// eslint.config.mjs
import { rweUnityEslintConfig } from "@rwe/unity-eslint-config";
import { defineConfig } from "eslint/config";

export default defineConfig(...rweUnityEslintConfig.configs.recommended);
```

### Stylelint

```powershell
npm install @rwe/unity-stylelint-config --save-dev
```

```javascript
// stylelint.config.js
module.exports = {
  extends: ["@rwe/unity-stylelint-config"],
};
```

---

## 7. Theming

Unity supports three theme modes applied as CSS classes on `<body>`:

| Mode            | CSS Class              |
| --------------- | ---------------------- |
| Light (default) | `energy-light-mode`    |
| Dark            | `energy-dark-mode`     |
| Contrast        | `energy-contrast-mode` |

The `<rwe-theme-menu />` component provides a UI toggle. Programmatically:

```typescript
import { RweThemeService } from "@rwe/unity-lib/core";

const theme = inject(RweThemeService);
theme.theme(); // Signal<string> - current theme
```

### SCSS Architecture

The `rwe.ui.theming.scss` follows ITCSS architecture:

1. **Settings** — Design tokens
2. **Tools** — Mixins/functions
3. **Generic** — Base styles
4. **Elements** — HTML defaults
5. **Objects** — Layout patterns
6. **Components** — Component styles
7. **Trumps** — Utilities/overrides (all `rwe-*` utility classes)
