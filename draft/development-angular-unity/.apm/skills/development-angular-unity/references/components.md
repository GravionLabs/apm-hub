# RWE Unity Component Reference

Complete API reference for the public Angular components in `@rwe/unity-lib`, organised by category.

Use this file when you need selectors, import paths, inputs, outputs, projected content, and the most important model types.

---

## Layout

### rwe-application-frame

**Selector:** `rwe-application-frame`
**Import:** `@rwe/unity-lib/application-frame`

Main application shell. Uses content projection for structural slots.

**Projected content slots:**

- `rwe-header`
- `rwe-aside-left`
- `rwe-main`
- `rwe-aside-right`
- `rwe-footer`

```html
<rwe-application-frame>
  <rwe-header>...</rwe-header>
  <rwe-main><router-outlet /></rwe-main>
  <rwe-footer />
</rwe-application-frame>
```

### rwe-header

**Selector:** `rwe-header`
**Import:** `@rwe/unity-lib/application-frame`

Header slot container.

**Projected child slots:**

- `rwe-left`
- `rwe-center`
- `rwe-right`

### rwe-main

**Selector:** `rwe-main`
**Import:** `@rwe/unity-lib/application-frame`

#### Inputs

| Name          | Type      | Default | Description                     |
| ------------- | --------- | ------- | ------------------------------- |
| `withPadding` | `boolean` | `true`  | Adds default Unity page padding |

### rwe-aside-left / rwe-aside-right

**Selectors:** `rwe-aside-left`, `rwe-aside-right`
**Import:** `@rwe/unity-lib/application-frame`

#### Inputs

| Name     | Type            | Default | Description                          |
| -------- | --------------- | ------- | ------------------------------------ |
| `mode`   | `MatDrawerMode` | —       | Drawer mode (`side`, `over`, `push`) |
| `opened` | `boolean`       | `false` | Whether the aside is open            |

### rwe-footer

**Selector:** `rwe-footer`
**Import:** `@rwe/unity-lib/application-frame`

#### Inputs

| Name             | Type                           | Default  | Description             |
| ---------------- | ------------------------------ | -------- | ----------------------- |
| `routes`         | `RweFooterRouteLink[] \| null` | —        | Footer navigation links |
| `appVersion`     | `string \| null`               | —        | Application version     |
| `showApiVersion` | `boolean \| null`              | —        | Shows Unity API version |
| `environment`    | `string \| null`               | —        | Environment label       |
| `warn`           | `RweFooterWarnMode \| null`    | `'auto'` | Red footer warning mode |

#### Types

```ts
interface RweFooterRouteLink {
  name: string;
  link: string;
}

type RweFooterWarnMode = undefined | null | "" | "auto" | "on" | "off";
```

### rwe-card

**Selector:** `rwe-card`
**Import:** `@rwe/unity-lib/card`

#### Inputs

| Name              | Type             | Default  |
| ----------------- | ---------------- | -------- |
| `centered`        | `boolean`        | `false`  |
| `label`           | `string \| null` | —        |
| `decoratedTop`    | `boolean`        | `false`  |
| `decoratedBottom` | `boolean`        | `false`  |
| `height`          | `string`         | `'auto'` |
| `width`           | `string`         | `'auto'` |

### rwe-details-frame

**Selector:** `rwe-details-frame`
**Import:** `@rwe/unity-lib/details-frame`

Three-column details layout.

**Projected slots:**

- `rwe-left` or `[rweLeft]`
- `rwe-center`
- `rwe-right` or `[rweRight]`

### rwe-list-frame

**Selector:** `rwe-list-frame`
**Import:** `@rwe/unity-lib/list-frame`

Template-driven list frame for side panels and master-detail layouts.

#### Inputs

| Name        | Type                                        | Default   |
| ----------- | ------------------------------------------- | --------- |
| `height`    | `string`                                    | `'100%'`  |
| `width`     | `string`                                    | `'25rem'` |
| `itemSize`  | `number \| null \| undefined`               | —         |
| `items`     | `T[] \| null \| undefined`                  | —         |
| `trackBy`   | `TrackByFunction<T>`                        | required  |
| `tmplItem`  | `TemplateRef<unknown>`                      | required  |
| `error`     | `unknown \| null \| undefined`              | —         |
| `tmplTotal` | `TemplateRef<unknown> \| null \| undefined` | —         |

### rwe-accordion

**Selector:** `rwe-accordion`
**Import:** `@rwe/unity-lib/accordion`

#### Inputs

| Name              | Type                       | Default |
| ----------------- | -------------------------- | ------- |
| `flat`            | `boolean`                  | `true`  |
| `singleSelection` | `boolean`                  | `false` |
| `toggle`          | `'start' \| 'end' \| null` | `'end'` |
| `testId`          | `string \| null`           | —       |

### rwe-accordion-panel

**Selector:** `rwe-accordion-panel`
**Import:** `@rwe/unity-lib/accordion`

#### Inputs

| Name          | Type      | Default |
| ------------- | --------- | ------- |
| `description` | `string`  | —       |
| `disabled`    | `boolean` | `false` |
| `label`       | `string`  | —       |
| `opened`      | `boolean` | `false` |

**Projected content:**

- `rweAccordionContent` template

---

## Tabs And Lists

### rwe-tabs

**Selector:** `rwe-tabs`
**Import:** `@rwe/unity-lib/tabs`

#### Inputs

| Name                | Type                         | Default    |
| ------------------- | ---------------------------- | ---------- |
| `animationDuration` | `any`                        | `'0ms'`    |
| `headerRowLayout`   | `'inline' \| 'flex' \| null` | `'inline'` |
| `height`            | `any`                        | `'auto'`   |
| `selected`          | `number \| null`             | `0`        |
| `testId`            | `string \| null`             | —          |

#### Outputs

| Name             | Type                   |
| ---------------- | ---------------------- |
| `selectedChange` | `EventEmitter<number>` |

### rwe-tab

**Selector:** `rwe-tab`
**Import:** `@rwe/unity-lib/tabs`

#### Inputs

| Name       | Type              | Default |
| ---------- | ----------------- | ------- |
| `label`    | `string`          | `''`    |
| `disabled` | `boolean \| null` | —       |
| `icon`     | `string \| null`  | —       |
| `tooltip`  | `string \| null`  | —       |

### rwe-vlist

**Selector:** `rwe-vlist`
**Import:** `@rwe/unity-lib/vlist`

#### Inputs

| Name         | Type                 | Default |
| ------------ | -------------------- | ------- |
| `items`      | `T[] \| null`        | —       |
| `itemHeight` | `number`             | `50`    |
| `minBuffer`  | `number`             | `10`    |
| `maxBuffer`  | `number`             | `20`    |
| `trackBy`    | `TrackByFunction<T>` | —       |

---

## Buttons

### rwe-button

**Selector:** `rwe-button`
**Import:** `@rwe/unity-lib/button`

#### Inputs

| Name         | Type                    | Default     |
| ------------ | ----------------------- | ----------- |
| `ariaLabel`  | `string \| null`        | —           |
| `buttonType` | `RweButtonType \| null` | —           |
| `disabled`   | `boolean`               | `false`     |
| `emphasis`   | `RweButtonEmphasis`     | `'primary'` |
| `loading`    | `boolean`               | `false`     |
| `variant`    | `RweButtonVariant`      | `'filled'`  |
| `width`      | `string \| number`      | —           |
| `type`       | `HTMLButtonTypes`       | `'button'`  |

#### Types

```ts
type RweButtonType = "primary" | "secondary" | "tertiary" | "warn";
type RweButtonVariant = "text" | "filled" | "elevated" | "outlined";
type RweButtonEmphasis = "primary" | "secondary" | "accent" | "error";
type HTMLButtonTypes = "submit" | "reset" | "button";
```

### rwe-icon-button

**Selector:** `rwe-icon-button`
**Import:** `@rwe/unity-lib/icon-button`

#### Inputs

| Name         | Type                    | Default     |
| ------------ | ----------------------- | ----------- |
| `ariaLabel`  | `string \| null`        | —           |
| `buttonType` | `RweIconButtonType`     | —           |
| `disabled`   | `any`                   | —           |
| `emphasis`   | `RweButtonEmphasis`     | `'primary'` |
| `icon`       | `string \| null`        | —           |
| `label`      | `string \| null`        | —           |
| `loading`    | `boolean`               | —           |
| `variant`    | `RweIconButtonVariants` | —           |
| `type`       | `HTMLButtonTypes`       | `'button'`  |

```ts
type RweIconButtonType = "primary" | "secondary" | "tertiary" | "warn";
type RweIconButtonVariants = "rounded" | "basic";
```

### rwe-menu-button

**Selector:** `rwe-menu-button`
**Import:** `@rwe/unity-lib/menu-button`

#### Outputs

| Name        | Type                 |
| ----------- | -------------------- |
| `menuClick` | `EventEmitter<void>` |

---

## Form Components

All form components are designed for Angular forms and support `ControlValueAccessor` patterns where applicable.

### Shared Option Type

```ts
interface RweOption<T> {
  label?: string;
  value: T;
}
```

### rwe-form-input

**Selector:** `rwe-form-input`
**Import:** `@rwe/unity-lib/form-input`

#### Inputs

| Name         | Type                                                                           | Default  |
| ------------ | ------------------------------------------------------------------------------ | -------- |
| `value`      | `any`                                                                          | —        |
| `showHint`   | `boolean`                                                                      | `true`   |
| `hint`       | `string \| null`                                                               | —        |
| `canReset`   | `boolean \| null`                                                              | —        |
| `prefix`     | `string \| null`                                                               | —        |
| `rows`       | `number \| null`                                                               | —        |
| `suffix`     | `string \| null`                                                               | —        |
| `canDisable` | `boolean \| null`                                                              | —        |
| `readonly`   | `boolean`                                                                      | —        |
| `type`       | `'email' \| 'number' \| 'password' \| 'tel' \| 'text' \| 'time' \| 'textarea'` | `'text'` |
| `error`      | `any`                                                                          | —        |
| `testId`     | `string \| null`                                                               | —        |

#### Outputs

| Name          | Type                |
| ------------- | ------------------- |
| `valueChange` | `EventEmitter<any>` |

### rwe-form-select

**Selector:** `rwe-form-select`
**Import:** `@rwe/unity-lib/form-select`

#### Inputs

| Name                 | Type                         | Default |
| -------------------- | ---------------------------- | ------- |
| `value`              | `T \| null`                  | —       |
| `autoSelectOne`      | `boolean \| null`            | —       |
| `options`            | `RweSelectItem<T>[] \| null` | —       |
| `panelWidth`         | `TypeFormSelectPanelWidth`   | —       |
| `showHint`           | `boolean`                    | `true`  |
| `hint`               | `string \| null`             | —       |
| `canReset`           | `boolean \| null`            | —       |
| `sortAlphabetically` | `boolean \| null`            | —       |
| `readonly`           | `boolean`                    | —       |
| `error`              | `any`                        | —       |
| `testId`             | `string \| null`             | —       |

#### Outputs

| Name          | Type                      |
| ------------- | ------------------------- |
| `valueChange` | `EventEmitter<T \| null>` |

```ts
type RweSelectItem<T> = RweOption<T>;
```

### rwe-form-select-multi

**Selector:** `rwe-form-select-multi`
**Import:** `@rwe/unity-lib/form-select-multi`

#### Inputs

| Name                  | Type                              | Default |
| --------------------- | --------------------------------- | ------- |
| `value`               | `T[] \| null`                     | —       |
| `customLabelAll`      | `string \| null`                  | —       |
| `options`             | `RweSelectMultiItem<T>[] \| null` | —       |
| `hint`                | `string \| null`                  | —       |
| `canReset`            | `boolean \| null`                 | —       |
| `readonly`            | `boolean`                         | —       |
| `showLabelAll`        | `boolean \| null`                 | —       |
| `showSelectedOptions` | `boolean \| null`                 | —       |
| `error`               | `string \| null`                  | —       |
| `testId`              | `string \| null`                  | —       |
| `sortAlphabetically`  | `boolean \| null`                 | —       |

```ts
type RweSelectMultiItem<T> = RweOption<T>;
```

### rwe-form-autocomplete

**Selector:** `rwe-form-autocomplete`
**Import:** `@rwe/unity-lib/form-autocomplete`

#### Inputs

| Name                 | Type                               | Default |
| -------------------- | ---------------------------------- | ------- |
| `value`              | `T \| null`                        | —       |
| `autoSelectOne`      | `boolean \| null`                  | —       |
| `options`            | `RweAutocompleteItem<T>[] \| null` | —       |
| `panelWidth`         | `TypeFormSelectPanelWidth`         | —       |
| `hint`               | `string \| null`                   | —       |
| `canReset`           | `boolean \| null`                  | —       |
| `sortAlphabetically` | `boolean \| null`                  | —       |
| `readonly`           | `boolean`                          | —       |
| `error`              | `string \| null`                   | —       |

#### Outputs

| Name          | Type                      |
| ------------- | ------------------------- |
| `valueChange` | `EventEmitter<T \| null>` |

```ts
type RweAutocompleteItem<T> = RweOption<T>;
```

### rwe-form-autocomplete-chips

**Selector:** `rwe-form-autocomplete-chips`
**Import:** `@rwe/unity-lib/form-autocomplete-chips`

#### Inputs

| Name                 | Type                                    | Default |
| -------------------- | --------------------------------------- | ------- |
| `value`              | `T[] \| null`                           | —       |
| `options`            | `RweAutocompleteChipsItem<T>[] \| null` | —       |
| `panelWidth`         | `TypeFormSelectPanelWidth`              | —       |
| `hint`               | `string \| null`                        | —       |
| `canReset`           | `boolean \| null`                       | —       |
| `sortAlphabetically` | `boolean \| null`                       | —       |
| `readonly`           | `boolean`                               | —       |
| `error`              | `string \| null`                        | —       |

#### Outputs

| Name          | Type                        |
| ------------- | --------------------------- |
| `valueChange` | `EventEmitter<T[] \| null>` |

```ts
type RweAutocompleteChipsItem<T> = RweOption<T>;
```

### rwe-form-checkbox

**Selector:** `rwe-form-checkbox`
**Import:** `@rwe/unity-lib/form-checkbox`

#### Inputs

| Name       | Type              | Default |
| ---------- | ----------------- | ------- |
| `value`    | `boolean \| null` | —       |
| `hint`     | `string \| null`  | —       |
| `readonly` | `boolean`         | —       |
| `error`    | `string \| null`  | —       |

#### Outputs

| Name          | Type                            |
| ------------- | ------------------------------- |
| `valueChange` | `EventEmitter<boolean \| null>` |

### rwe-form-radio

**Selector:** `rwe-form-radio`
**Import:** `@rwe/unity-lib/form-radio`

#### Inputs

| Name       | Type                        | Default |
| ---------- | --------------------------- | ------- |
| `value`    | `T \| null`                 | —       |
| `options`  | `RweRadioItem<T>[] \| null` | —       |
| `readonly` | `boolean`                   | —       |
| `hint`     | `string \| null`            | —       |
| `error`    | `string \| null`            | —       |

#### Outputs

| Name          | Type                      |
| ------------- | ------------------------- |
| `valueChange` | `EventEmitter<T \| null>` |

```ts
type RweRadioItem<T> = RweOption<T>;
```

### rwe-form-slide-toggle

**Selector:** `rwe-form-slide-toggle`
**Import:** `@rwe/unity-lib/form-slide-toggle`

#### Inputs

| Name       | Type              | Default |
| ---------- | ----------------- | ------- |
| `value`    | `boolean \| null` | —       |
| `disabled` | `any`             | —       |
| `readonly` | `boolean`         | —       |
| `showHint` | `boolean`         | `true`  |
| `hint`     | `string \| null`  | —       |
| `error`    | `string \| null`  | —       |
| `testId`   | `string \| null`  | —       |

#### Outputs

| Name          | Type                            |
| ------------- | ------------------------------- |
| `valueChange` | `EventEmitter<boolean \| null>` |

### rwe-form-toggle

**Selector:** `rwe-form-toggle`
**Import:** `@rwe/unity-lib/form-toggle`

#### Inputs

| Name                     | Type                         | Default |
| ------------------------ | ---------------------------- | ------- |
| `value`                  | `T \| null`                  | —       |
| `options`                | `RweToggleItem<T>[] \| null` | —       |
| `hint`                   | `string \| null`             | —       |
| `error`                  | `string \| null`             | —       |
| `readonly`               | `boolean`                    | —       |
| `hideText`               | `boolean \| null`            | —       |
| `showSelectionIndicator` | `boolean \| null`            | `true`  |

#### Outputs

| Name          | Type                      |
| ------------- | ------------------------- |
| `valueChange` | `EventEmitter<T \| null>` |

```ts
interface RweToggleItem<T> {
  disabled?: boolean;
  label?: string;
  icon?: string;
  tooltip?: string;
  value: T;
}
```

### rwe-form-datepicker

**Selector:** `rwe-form-datepicker`
**Import:** `@rwe/unity-lib/form-datepicker`

#### Inputs

| Name                         | Type                                          | Default |
| ---------------------------- | --------------------------------------------- | ------- |
| `value`                      | `any`                                         | —       |
| `hint`                       | `string \| null`                              | —       |
| `prefix`                     | `string \| null`                              | —       |
| `canReset`                   | `boolean \| null`                             | —       |
| `textFieldEditable`          | `boolean \| null`                             | —       |
| `readonly`                   | `boolean`                                     | —       |
| `error`                      | `string \| null`                              | —       |
| `icon`                       | `string \| null`                              | —       |
| `startView`                  | `'month' \| 'year' \| 'multi-year' \| null`   | —       |
| `granularity`                | `RweFormDatepickerGranularity \| null`        | —       |
| `min`                        | `any`                                         | —       |
| `max`                        | `any`                                         | —       |
| `dateFilter`                 | `any`                                         | —       |
| `specialErrorRepresentation` | `RweDatepickerSpecialErrorPipeLabels \| null` | —       |
| `testId`                     | `string \| null`                              | —       |

#### Outputs

| Name          | Type                |
| ------------- | ------------------- |
| `valueChange` | `EventEmitter<any>` |

```ts
type RweFormDatepickerGranularity = "day" | "month" | "year";
```

### rwe-form-datepicker-range

**Selector:** `rwe-form-datepicker-range`
**Import:** `@rwe/unity-lib/form-datepicker-range`

#### Signal Inputs

| Name          | Type                       |
| ------------- | -------------------------- |
| `controlFrom` | `FormControl<any> \| null` |
| `controlTo`   | `FormControl<any> \| null` |

#### Standard Inputs

| Name                         | Type                                          | Default |
| ---------------------------- | --------------------------------------------- | ------- |
| `valueFrom`                  | `any`                                         | —       |
| `valueTo`                    | `any`                                         | —       |
| `hint`                       | `string \| null`                              | —       |
| `label`                      | `string \| null`                              | —       |
| `prefix`                     | `string \| null`                              | —       |
| `canReset`                   | `boolean \| null`                             | —       |
| `textFieldEditable`          | `boolean \| null`                             | —       |
| `error`                      | `string \| null`                              | —       |
| `width`                      | `string \| null`                              | —       |
| `icon`                       | `string \| null`                              | —       |
| `startView`                  | `'month' \| 'year' \| 'multi-year' \| null`   | —       |
| `min`                        | `any`                                         | —       |
| `max`                        | `any`                                         | —       |
| `readonly`                   | `boolean`                                     | —       |
| `specialErrorRepresentation` | `RweDatepickerSpecialErrorPipeLabels \| null` | —       |
| `testId`                     | `string \| null`                              | —       |

#### Outputs

| Name              | Type                |
| ----------------- | ------------------- |
| `valueFromChange` | `EventEmitter<any>` |
| `valueToChange`   | `EventEmitter<any>` |

### rwe-form-timepicker

**Selector:** `rwe-form-timepicker`
**Import:** `@rwe/unity-lib/form-timepicker`

#### Inputs

| Name                         | Type                                          | Default |
| ---------------------------- | --------------------------------------------- | ------- |
| `value`                      | `any`                                         | —       |
| `showHint`                   | `boolean`                                     | `true`  |
| `hint`                       | `string \| null`                              | —       |
| `canReset`                   | `boolean \| null`                             | —       |
| `readonly`                   | `boolean`                                     | —       |
| `error`                      | `any`                                         | —       |
| `min`                        | `string \| null`                              | —       |
| `max`                        | `string \| null`                              | —       |
| `specialErrorRepresentation` | `RweTimepickerSpecialErrorPipeLabels \| null` | —       |
| `testId`                     | `string \| null`                              | —       |
| `options`                    | `MatTimepickerOption<Date>[] \| null`         | —       |

#### Outputs

| Name          | Type                |
| ------------- | ------------------- |
| `valueChange` | `EventEmitter<any>` |

### rwe-file-drop

**Selector:** `rwe-file-drop`
**Import:** `@rwe/unity-lib/file-drop`

#### Inputs

| Name              | Type                         | Default         |
| ----------------- | ---------------------------- | --------------- |
| `iconPlaceholder` | `string`                     | `'upload_file'` |
| `accept`          | `string \| string[] \| null` | —               |
| `maxSize`         | `number \| null`             | —               |
| `files`           | `File[] \| null`             | —               |

#### Outputs

| Name          | Type                   |
| ------------- | ---------------------- |
| `filesChange` | `EventEmitter<File[]>` |

---

## Navigation

### rwe-navigation

**Selector:** `rwe-navigation`
**Import:** `@rwe/unity-lib/navigation`

#### Inputs

| Name          | Type                          | Default  |
| ------------- | ----------------------------- | -------- |
| `routes`      | `RweNavigationLink[] \| null` | —        |
| `showToolTip` | `boolean \| null`             | `true`   |
| `type`        | `RweNavigationType \| null`   | `'rail'` |

#### Outputs

| Name            | Type                |
| --------------- | ------------------- |
| `actionPayload` | `EventEmitter<any>` |

```ts
interface RweNavigationLinkChild {
  cssClass?: string;
  disabled?: boolean;
  external?: boolean;
  link?: string;
  loading?: boolean;
  name: string;
  payload?: any;
  tooltip?: string | null;
  testId?: string | null;
}

interface RweNavigationLink extends RweNavigationLinkChild {
  children?: RweNavigationLinkChild[];
  icon?: string;
}

type RweNavigationType = "collapsed" | "rail" | "extended";
```

### rwe-nav-bar

**Selector:** `rwe-nav-bar`
**Import:** `@rwe/unity-lib/nav-bar`

#### Inputs

| Name         | Type                      | Default |
| ------------ | ------------------------- | ------- |
| `layout`     | `'row' \| 'column'`       | `'row'` |
| `routes`     | `RweNavBarItem[] \| null` | —       |
| `hideLabels` | `boolean \| null`         | —       |

```ts
interface RweNavBarItem {
  disabled?: boolean;
  icon?: string;
  label?: string;
  route: string;
  tooltip?: string;
  testId?: string;
}
```

### rwe-nav-tabs

**Selector:** `rwe-nav-tabs`
**Import:** `@rwe/unity-lib/nav-tabs`

#### Inputs

| Name        | Type                      | Default |
| ----------- | ------------------------- | ------- |
| `routes`    | `RweNavTabItem[] \| null` | —       |
| `inline`    | `boolean \| null`         | —       |
| `fullWidth` | `boolean \| null`         | —       |

```ts
interface RweNavTabItem {
  disabled?: boolean;
  icon?: string;
  label?: string;
  queryParams?: Params;
  queryParamsHandling?: QueryParamsHandling;
  route?: string;
  tooltip?: string;
}
```

### rwe-nav-list

**Selector:** `rwe-nav-list`
**Import:** `@rwe/unity-lib/nav-list`

#### Inputs

| Name     | Type                       | Default |
| -------- | -------------------------- | ------- |
| `routes` | `RweNavListItem[] \| null` | —       |

### rwe-breadcrumb-menu

**Selector:** `rwe-breadcrumb-menu`
**Import:** `@rwe/unity-lib/breadcrumb`

#### Inputs

| Name           | Type                   | Default   |
| -------------- | ---------------------- | --------- |
| `items`        | `Breadcrumb[] \| null` | —         |
| `maxItemWidth` | `string`               | `'10rem'` |

```ts
interface BreadcrumbMenuItem {
  label: string;
  route: string;
  tooltip?: string;
}

interface Breadcrumb {
  label: string;
  menuItems?: BreadcrumbMenuItem[];
  route?: string;
  tooltip?: string;
}
```

### rwe-back-button

**Selector:** `rwe-back-button`
**Import:** `@rwe/unity-lib/back-button`

#### Inputs

| Name    | Type                            | Default            |
| ------- | ------------------------------- | ------------------ |
| `mode`  | `'history' \| 'router' \| null` | `'history'`        |
| `label` | `string \| null`                | translated default |

### rwe-last-used-menu

**Selector:** `rwe-last-used-menu`
**Import:** `@rwe/unity-lib/last-used-menu`

#### Inputs

| Name   | Type             | Default       |
| ------ | ---------------- | ------------- |
| `icon` | `string \| null` | `'bookmarks'` |

---

## State And Feedback

### rwe-state-message

**Selector:** `rwe-state-message`
**Import:** `@rwe/unity-lib/state-message`

#### Inputs

| Name          | Type                                    | Default  |
| ------------- | --------------------------------------- | -------- |
| `messageType` | `RweStateMessageType \| null`           | —        |
| `variant`     | `RweStateVariant \| null`               | `'full'` |
| `icon`        | `RweIconFont \| string \| null`         | —        |
| `actions`     | `RweStateMessageActionConfig[] \| null` | —        |

```ts
interface RweStateMessageActionConfig {
  label: string;
  variant?: RweButtonVariant;
  emphasis?: RweButtonEmphasis;
  type?: RweButtonType;
  trigger$?: Subject<void>;
  testId?: string;
}

type RweStateMessageType = "info" | "success" | "warn" | "error";
type RweStateVariant = "inline" | "full";
```

### rwe-chip

**Selector:** `rwe-chip`
**Import:** `@rwe/unity-lib/chip`

#### Inputs

| Name         | Type                                                       | Default     |
| ------------ | ---------------------------------------------------------- | ----------- |
| `filled`     | `boolean`                                                  | `false`     |
| `id`         | `string`                                                   | —           |
| `removable`  | `boolean`                                                  | `false`     |
| `removeIcon` | `string`                                                   | `'RWE_125'` |
| `value`      | `string`                                                   | —           |
| `variant`    | `'default' \| 'info' \| 'error' \| 'success' \| 'warning'` | `'default'` |

#### Outputs

| Name      | Type                           |
| --------- | ------------------------------ |
| `removed` | `EventEmitter<string \| null>` |

### rwe-notification

**Selector:** `rwe-notification`
**Import:** `@rwe/unity-lib/notification`

#### Inputs

| Name           | Type                  |
| -------------- | --------------------- |
| `notification` | `RweNotificationItem` |

#### Outputs

| Name      | Type                                |
| --------- | ----------------------------------- |
| `dismiss` | `EventEmitter<RweNotificationItem>` |

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

### rwe-loader

**Selector:** `rwe-loader`
**Import:** `@rwe/unity-lib/loader`

Shows a loader when one or more busy flags are active. Usually configured via `provideUnityLib({ showLoaderOnRequests, showLoaderOnRouting })`.

### rwe-loader-line

**Selector:** `rwe-loader-line`
**Import:** `@rwe/unity-lib/loader-line`

#### Inputs

| Name        | Type             | Default                  |
| ----------- | ---------------- | ------------------------ |
| `active`    | `any`            | —                        |
| `ariaLabel` | `string \| null` | `'Loading progress bar'` |

### rwe-dialog-confirm

**Selector:** `rwe-dialog-confirm`
**Import:** `@rwe/unity-lib/confirm`

Dialog component used by the `RweConfirmation` service.

---

## Data Display

### rwe-table

**Selector:** `rwe-table`
**Import:** `@rwe/unity-lib/table`

High-level Material table wrapper with filtering, sorting, row selection, inline editing, pagination, lazy loading, action bars, and custom templates.

#### Core Inputs

| Name                    | Type                                                                                 | Default |
| ----------------------- | ------------------------------------------------------------------------------------ | ------- |
| `actionBarButtons`      | `RweTableActionButton[]`                                                             | `[]`    |
| `actionBarPosition`     | `RweActionBarPosition \| null`                                                       | —       |
| `actionBarToggle`       | `RweTableActionToggle \| null`                                                       | `null`  |
| `compact`               | `boolean`                                                                            | `false` |
| `dataSource`            | `MatTableDataSource<T> \| T[] \| null`                                               | —       |
| `dense`                 | `boolean`                                                                            | `true`  |
| `displayedColumns`      | `ColumnConfig<T>[] \| null`                                                          | —       |
| `enableCopyTextOnClick` | `boolean`                                                                            | `true`  |
| `enableStickyHeader`    | `boolean`                                                                            | `false` |
| `mintColorFn`           | `FnItemMint<T> \| null`                                                              | —       |
| `resizableColumns`      | `boolean`                                                                            | `false` |
| `templateRefCell`       | `TemplateRef<unknown> \| null`                                                       | —       |
| `toCellCss`             | `((param: { col: ColumnConfig<T>; row: T }) => string \| null \| undefined) \| null` | —       |
| `toColumnCss`           | `((col: ColumnConfig<T>) => string \| null \| undefined) \| null`                    | —       |
| `toRowCss`              | `((row: T) => string \| null \| undefined) \| null`                                  | —       |
| `trackByRow`            | `TrackByFunction<T> \| null`                                                         | —       |
| `useEllipsis`           | `boolean \| null`                                                                    | `true`  |

#### Outputs

| Name             | Type       |
| ---------------- | ---------- |
| `contentChanged` | `output()` |

#### Host-Directive Features

**Editing**

- `dataKey: keyof T | null = null`
- Methods: `initRowEditing(row)`, `isRowEditing(row)`, `cancelRowEditing(row)`, `submitRowEditing(row)`

**Filtering**

- `filter = model<string | null>()`
- `filterLabel = input<string | null>('Filter')`
- `filterMap = model<Record<string, string | null | undefined> | null>()`
- `filteringMode = input<RweTableFilteringType | null>()`
- `filterPlaceholder = input<string | null>('Filtering text')`
- Outputs: `filterChange`, `filterMapChange`

**Sorting**

- `enableSorting = input(false)`
- `sort = model<Sort | null>()`
- Output: `sortChange`

**Row Selection**

- `allSelected = model(false)`
- `allSelectedHidden = input(false)`
- `enableRowSelection = input(false)`
- `selectableColumnName = input<string | null>()`
- `selectableColumnNameDisabled = input(false)`
- Outputs: `allSelectedChange`, `deselectedRow`, `selectedChange`, `selectedRow`

**Pagination / Lazy**

- `lazy = input(false)`
- `lazyDefaultInit = input<boolean | null>(true)`
- `lazyPage = input<T[] | null>(null)`
- `lazyTotal = input<number | null>(null)`
- `pageIndex = input<number | null>()`
- `pageSize = input<number | null>()`
- `pageSizes = input<number[] | null>([5, 10, 25, 100])`
- `showPagination = input(false)`
- `showFirstLastButtons = input(false)`
- Output: `lazyLoad<RweTablePage>`

#### Key Types

```ts
interface ColumnConfig<ROW extends Row = Row> {
  align?: "start" | "center" | "end";
  alignCell?: "start" | "center" | "end";
  cellTemplate?: TemplateRef<unknown>;
  displayIcon?: string;
  displayName: string;
  disableToolTip?: boolean;
  filterable?: boolean;
  filterType?: "text" | "select";
  filterOptions?: RweSelectItem<any>[];
  icon?: string;
  inputTemplate?: TemplateRef<unknown>;
  name: keyof ROW & string;
  outputTemplate?: TemplateRef<unknown>;
  routePrefix?: string;
  sortable?: boolean;
  sticky?: boolean;
  transformFn?: (row: ROW) => unknown;
  useTemplate?: boolean;
  width?: string;
}

interface RweTablePage {
  page: number;
  pageSize: number;
  take: number;
  skip: number;
}

interface RweTableSelectedChange<T> {
  row: T;
  selected: boolean;
}

type RweTableFilteringType = "columnFilter" | "generalFilter";
type RweActionBarPosition = "top" | "bottom";
```

### rwe-http-request-wrap-frame

**Selector:** `rwe-http-request-wrap-frame`
**Import:** `@rwe/unity-lib/http-request-wrap-frame`

Helper component for request-state UIs.

#### Inputs

| Name                | Type                                                  | Default |
| ------------------- | ----------------------------------------------------- | ------- |
| `request$`          | `Observable<HttpRequestWrap<T>> \| null \| undefined` | —       |
| `tmplHeaderContent` | `TemplateRef<{ $implicit: T }> \| null`               | —       |
| `tmplBodyContent`   | `TemplateRef<{ $implicit: T }> \| null`               | —       |
| `errorTitle`        | `string \| null`                                      | —       |
| `noDataMessage`     | `string \| null`                                      | —       |
| `errorToString`     | `(<E>(error: E) => string) \| null`                   | —       |

```ts
interface HttpRequestWrap<T> {
  body?: T;
  busy: boolean;
  error?: unknown;
}
```

---

## Branding And Menus

### rwe-app-logo

**Selector:** `rwe-app-logo`
**Import:** `@rwe/unity-lib/app-logo`

#### Inputs

| Name       | Type             | Default |
| ---------- | ---------------- | ------- |
| `src`      | `string \| null` | —       |
| `alt`      | `string \| null` | —       |
| `route`    | `string \| null` | `'/'`   |
| `lightSrc` | `string \| null` | —       |
| `darkSrc`  | `string \| null` | —       |

### rwe-logo

**Selector:** `rwe-logo`
**Import:** `@rwe/unity-lib/logo`

#### Inputs

| Name            | Type              | Default  |
| --------------- | ----------------- | -------- |
| `alt`           | `string`          | `'RWE'`  |
| `width`         | `any`             | `'20px'` |
| `srcCustomLogo` | `string \| null`  | —        |
| `isInlineSvg`   | `boolean \| null` | —        |

### rwe-create-logo

**Selector:** `rwe-create-logo`
**Import:** `@rwe/unity-lib/create-logo`

#### Inputs

| Name      | Type             | Default |
| --------- | ---------------- | ------- |
| `icon`    | `string \| null` | —       |
| `name`    | `string \| null` | —       |
| `subline` | `string \| null` | —       |

### rwe-app-menu

**Selector:** `rwe-app-menu`
**Import:** `@rwe/unity-lib/app-menu`

#### Inputs

| Name     | Type                         | Default   |
| -------- | ---------------------------- | --------- |
| `apps`   | `RweAppMenuOption[] \| null` | —         |
| `testId` | `string \| null`             | —         |
| `target` | `'_blank' \| '_self'`        | `'_self'` |

```ts
interface RweAppMenuOption {
  name: string;
  logoPath: string;
  url: string;
  active: boolean;
  testId?: string | null;
}
```

### rwe-language-menu

**Selector:** `rwe-language-menu`
**Import:** `@rwe/unity-lib/language-menu`

#### Inputs

| Name             | Type                            | Default |
| ---------------- | ------------------------------- | ------- |
| `languages`      | `RweLanguageMenuItem[] \| null` | —       |
| `language`       | `string \| null`                | —       |
| `reloadOnChange` | `boolean`                       | `true`  |

#### Outputs

| Name             | Type                   |
| ---------------- | ---------------------- |
| `languageChange` | `EventEmitter<string>` |

### rwe-theme-menu

**Selector:** `rwe-theme-menu`
**Import:** `@rwe/unity-lib/theme-menu`

No public inputs or outputs. Switches between `energy-light-mode`, `energy-dark-mode`, and `energy-contrast-mode`.

### rwe-user

**Selector:** `rwe-user`
**Import:** `@rwe/unity-lib/user`

#### Inputs

| Name          | Type             | Default    |
| ------------- | ---------------- | ---------- |
| `showLogout`  | `boolean`        | `true`     |
| `labelLogout` | `string`         | `'Logout'` |
| `testId`      | `string \| null` | —          |

#### Outputs

| Name     | Type                 |
| -------- | -------------------- |
| `logout` | `EventEmitter<void>` |

### rwe-unity-version

**Selector:** `rwe-unity-version`
**Import:** `@rwe/unity-lib/unity-version`

Displays the injected Unity package version.
