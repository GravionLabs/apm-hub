# RWE Unity Services Reference

Angular injectable services, providers, and related DI patterns from `@rwe/unity-lib`.

---

## Bootstrap And Core Providers

### provideUnityLib

**Import:** `@rwe/unity-lib/core`

Primary setup function for Unity.

```ts
function provideUnityLib(cfg?: RweUnityLibModuleCfg): EnvironmentProviders;
```

Use it once in `bootstrapApplication()` to configure themes, notifications, loaders, caching, i18n integration, and app defaults.

### provideRweTranslations

**Import:** `@rwe/unity-lib/loca`

Configures Unity translations on top of `@ngx-translate/core`.

```ts
function provideRweTranslations(
  cfg?: RweTranslationLoadConfig,
): EnvironmentProviders;
```

Typical usage:

```ts
bootstrapApplication(AppComponent, {
  providers: [
    provideUnityLib({ handleLocaleInit: true }),
    provideRweTranslations({ localeDefault: UnityNgLocale.enGB }),
  ],
});
```

---

## Theme Service

### RweThemeService

**Import:** `@rwe/unity-lib/core`
**Scope:** `providedIn: 'root'`

Manages theme mode and applies the active theme class to `document.body`.

#### Types

```ts
enum RweUnityThemeModes {
  Light = "energy-light-mode",
  Dark = "energy-dark-mode",
  Contrast = "energy-contrast-mode",
}
```

#### Public API

```ts
readonly theme$: Observable<string | null>;
readonly theme: Signal<string | null>;
setTheme(theme: string): void;
```

#### Related token

```ts
const RweDefaultTheme: InjectionToken<RweUnityThemeModes>;
```

#### Example

```ts
const theme = inject(RweThemeService);
const currentTheme = theme.theme;

theme.setTheme(RweUnityThemeModes.Dark);
```

---

## Notifications

### RweNotificationService

**Import:** `@rwe/unity-lib/notification`
**Scope:** `providedIn: 'root'`

Displays toast-style notifications in an overlay container.

#### Public API

```ts
error(message: string, duration?: number, testId?: string): void;
info(message: string, duration = 4000, testId?: string): void;
success(message: string, duration = 3000, testId?: string): void;
warn(message: string, duration = 5000, testId?: string): void;
clear(): void;
```

#### Related types

```ts
enum RweNotificationLevel {
  Info = "rwe-notification-level-info",
  Success = "rwe-notification-level-success",
  Warning = "rwe-notification-level-warning",
  Error = "rwe-notification-level-error",
}

interface RweNotificationItem {
  duration?: number;
  level: RweNotificationLevel;
  message: string;
  testId?: string;
}
```

#### Example

```ts
const notify = inject(RweNotificationService);

notify.success("Saved");
notify.error("Unexpected server error", 8000);
```

#### Related DI tokens

- `RweDiNotifications`
- `RweDiHoveredNotifications`
- `RweDiNotificationTopMargin`

---

## Confirmation Dialogs

### RweConfirmation

**Import:** `@rwe/unity-lib/confirm`
**Scope:** `providedIn: 'root'`

Service wrapper around Angular Material dialogs for confirmations and custom dialogs.

#### Public API

```ts
confirm$<T = boolean>(
  data?: RweDialogConfirmData<T>,
  options?: MatDialogConfig<RweDialogConfirmData<T>>,
): Observable<T | null>;

dialog$<T, D = any, R = any>(
  component: ComponentType<T>,
  data?: D,
  options?: MatDialogConfig<D>,
): Observable<R | null>;
```

#### Dialog model

```ts
interface RweDialogConfirmAction<T> {
  label: string;
  value: T;
  testId?: string;
}

interface RweDialogConfirmActionButton<T> extends RweDialogConfirmAction<T> {
  buttonVariant?: RweButtonVariant;
  buttonEmphasis?: RweButtonEmphasis;
  buttonType?: RweButtonType;
}

interface RweDialogConfirmActionIconButton<
  T,
> extends RweDialogConfirmAction<T> {
  icon?: string;
  iconEmphasis?: RweButtonEmphasis;
  iconButtonType?: RweIconButtonType;
  iconVariant?: RweIconButtonVariants;
}

interface RweDialogConfirmData<T = unknown> {
  actions?: (RweDialogConfirmActionButton<T> &
    RweDialogConfirmActionIconButton<T>)[];
  contentTemplateRef?: TemplateRef<any>;
  actionsTemplateRef?: TemplateRef<any>;
  details?: string;
  label?: string;
  testId?: string;
}
```

#### Example

```ts
const confirm = inject(RweConfirmation);

confirm
  .confirm$<boolean>({
    label: "Delete customer?",
    details: "This action cannot be undone.",
    actions: [
      { label: "Cancel", value: false, buttonVariant: "outlined" },
      {
        label: "Delete",
        value: true,
        buttonVariant: "filled",
        buttonEmphasis: "primary",
      },
    ],
  })
  .subscribe((result) => {
    if (result) {
      // execute delete
    }
  });
```

---

## Titles And Localization

### RweTitleService

**Import:** `@rwe/unity-lib/core`

Manages a stack of scoped page titles.

#### Public API

```ts
add(value$: Observable<string | null | undefined>): void;
readonly title$: Observable<string>;
```

Use via the `rweTitle` directive unless you have a custom reason to push titles manually.

### RweLocalizationService

**Import:** `@rwe/unity-lib/core`

Provides access to Unity’s translation map.

#### Typical usage

Use `provideRweTranslations()` and inject the translate function token for most application code:

```ts
const t = inject(RweDiTranslate);
const label = t("accept");
```

#### Related tokens

- `RweDiTranslate`
- `RweDiTranslationMap`
- `RweDiLanguages`
- `RweLanguageStorageKey`

---

## Breakpoints

### RweDiLayoutBreakpointHits

**Import:** `@rwe/unity-lib/breakpoint`

Reactive DI token exposing Angular CDK breakpoint matches as a signal.

```ts
type BreakpointsKeys =
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "lt-sm"
  | "lt-md"
  | "lt-lg"
  | "lt-xl"
  | "gt-xs"
  | "gt-sm"
  | "gt-md"
  | "gt-lg";

const RweDiLayoutBreakpointHits: InjectionToken<
  Signal<Record<BreakpointsKeys, boolean>>
>;
```

#### Example

```ts
const breakpoints = inject(RweDiLayoutBreakpointHits);
const isMobile = computed(() => breakpoints()["lt-sm"]);
```

---

## Storage And Cache

### RweLocalStorageService

**Import:** `@rwe/unity-lib/core`
**Scope:** `providedIn: 'root'`

JSON-safe wrapper around browser local storage.

#### Public API

```ts
get<T>(key: string): T | null;
set<T>(key: string, value: T): void;
remove(key: string): void;
```

### RweCacheService

**Import:** `@rwe/unity-lib/core`

Coordinates cache storage and registered cache values through DI parts.

#### Public surface

```ts
readonly ready$: Observable<boolean>;
```

#### Related multi tokens

- `RweCacheStoragePart`
- `RweCacheValuePart`

Use `provideUnityLib({ localStorageCacheKey, localStorageCacheVersion })` to enable the local-storage cache integration.

---

## Downloads And File Selection

### RweDownloadService

**Import:** `@rwe/unity-lib/core`
**Scope:** `providedIn: 'root'`

Triggers file downloads from blobs.

#### Public API

```ts
downloadBlob(blob: Blob, fileName: string): void;
```

### RweSelectFileService

**Import:** `@rwe/unity-lib/core`
**Scope:** `providedIn: 'root'`

Opens the browser file picker and resolves selected files.

Use this if you need imperative file selection instead of the `rwe-file-drop` component.

---

## Form Service

### RweFormService

**Import:** `@rwe/unity-lib/core`

Wrapper for common Angular validators and form helpers.

#### Typical members

- `Validators.email`
- `Validators.min(...)`
- `Validators.max(...)`
- `Validators.minLength(...)`
- `Validators.maxLength(...)`
- `Validators.required`

Use it when working inside the library’s preferred validation patterns.

---

## Routing And Request State

### RweRouterService

**Import:** `@rwe/unity-lib/core`

Internal service that keeps router-related observables and busy state in sync.

Most application code should use `provideUnityLib({ showLoaderOnRouting: true })` rather than injecting this directly.

### HTTP request helpers

The library uses the shared `HttpRequestWrap<T>` model for request state:

```ts
interface HttpRequestWrap<T> {
  body?: T;
  busy: boolean;
  error?: unknown;
}
```

Use it with `rwe-http-request-wrap-frame` to render busy, error, empty, and success states consistently.

---

## Useful DI Tokens

### Unity version

```ts
const DiUnityVersion: InjectionToken<string>;
```

### Logging

```ts
enum RweLogLevels {
  Error,
  Warn,
  Info,
  Debug,
}

const RweLogLevel: InjectionToken<RweLogLevels>;
```

### Request tracking

- `RweDiRequestCounter`
- `RweDiIsRouting`
- `RweDiRouteUrl`
- `RweDiRouteUrlParts`

### Loaders

- `RweLoaderFlagPart`
- `RweDiLoaderBusy`

---

## Common Patterns

### Theme-aware application shell

```ts
bootstrapApplication(AppComponent, {
  providers: [
    provideUnityLib({
      defaultTheme: RweUnityThemeModes.Light,
      showLoaderOnRequests: true,
      showLoaderOnRouting: true,
    }),
  ],
});
```

### Localised setup

```ts
bootstrapApplication(AppComponent, {
  providers: [
    provideUnityLib({
      handleLocaleInit: true,
      locales: [UnityNgLocale.enGB, UnityNgLocale.deDE],
      setLanguageFromBrowserSettings: true,
    }),
    provideRweTranslations({ localeDefault: UnityNgLocale.enGB }),
  ],
});
```

### Cache setup

```ts
bootstrapApplication(AppComponent, {
  providers: [
    provideUnityLib({
      localStorageCacheKey: "customer-app",
      localStorageCacheVersion: 3,
    }),
  ],
});
```
