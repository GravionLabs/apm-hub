# RWE Unity Directives Reference

Reference for the public attribute directives and low-level UI helpers in `@rwe/unity-lib`.

---

## Popup

### [rwePopup]

**Import:** `@rwe/unity-lib/popup`
**Selector:** `[rwePopup]`

Shows an Angular template in a CDK overlay on hover.

#### Inputs

| Name              | Type                  | Description                           |
| ----------------- | --------------------- | ------------------------------------- |
| `rwePopup`        | `TemplateRef<object>` | Popup template                        |
| `rwePopupAnchor`  | `HTMLElement`         | Connected anchor element              |
| `rwePopupContext` | `T \| null`           | Optional `$implicit` template context |

#### Behavior

- Opens on `mouseenter`
- Closes on `mouseleave`
- Uses a flexible connected overlay with top and bottom fallback positions

#### Example

```html
<ng-template #tmpl let-value>
  <div class="rwe-sheet rwe-padding-small">{{ value }}</div>
</ng-template>

<div
  #anchor
  [rwePopup]="tmpl"
  [rwePopupAnchor]="anchor"
  [rwePopupContext]="'Hello'"
>
  Hover me
</div>
```

---

## Decoration

### [rweDecoLeft], [rweDecoRight], [rweDecoBottomLeft], [rweDecoBottomRight], [rweDecoTopLeft], [rweDecoTopRight]

**Import:** `@rwe/unity-lib/deco`
**Selector:** `[rweDecoLeft],[rweDecoRight],[rweDecoBottomLeft],[rweDecoBottomRight],[rweDecoTopLeft],[rweDecoTopRight]`

Applies Unity decorative SVG background classes.

#### Inputs

| Name                 | Type             | Description                     |
| -------------------- | ---------------- | ------------------------------- |
| `rweDecoOffsetX`     | `string \| null` | CSS `background-position-x`     |
| `rweDecoOffsetY`     | `string \| null` | CSS `background-position-y`     |
| `rweDecoSize`        | `string \| null` | CSS `background-size`           |
| `rweDecoLeft`        | `boolean`        | Enables left decoration         |
| `rweDecoRight`       | `boolean`        | Enables right decoration        |
| `rweDecoBottomLeft`  | `boolean`        | Enables bottom-left decoration  |
| `rweDecoBottomRight` | `boolean`        | Enables bottom-right decoration |
| `rweDecoTopLeft`     | `boolean`        | Enables top-left decoration     |
| `rweDecoTopRight`    | `boolean`        | Enables top-right decoration    |

#### Example

```html
<section
  rweDecoTopRight
  [rweDecoSize]="'20% auto'"
  [rweDecoOffsetY]="'1rem'"
></section>
```

---

## Size And Layout

### [rweSizeObserver]

**Import:** `@rwe/unity-lib/size-observer`
**Selector:** `[rweSizeObserver]`

Emits size changes via `ResizeObserver`.

#### Outputs

| Name                              | Type                   | Description        |
| --------------------------------- | ---------------------- | ------------------ |
| `rweSizeObserverBorderBoxHeight`  | `EventEmitter<number>` | Border-box height  |
| `rweSizeObserverBorderBoxWidth`   | `EventEmitter<number>` | Border-box width   |
| `rweSizeObserverContentBoxHeight` | `EventEmitter<number>` | Content-box height |
| `rweSizeObserverContentBoxWidth`  | `EventEmitter<number>` | Content-box width  |

#### Example

```html
<div
  rweSizeObserver
  (rweSizeObserverContentBoxWidth)="width = $event"
  (rweSizeObserverContentBoxHeight)="height = $event"
></div>
```

### [rweMatchParent]

**Import:** `@rwe/unity-lib/match-parent`
**Selector:** `[rweMatchParent]`

Applies CSS classes that stretch an element to its parent bounds.

#### Input

| Name             | Type                                          | Description                    |
| ---------------- | --------------------------------------------- | ------------------------------ |
| `rweMatchParent` | `RweMatchParentMode \| '' \| boolean \| null` | Full or side-specific matching |

#### Common modes

- `true` or empty attribute: full match-parent
- `'top'`
- `'right'`
- `'bottom'`
- `'left'`

### [rweGridRepeat]

**Import:** `@rwe/unity-lib/grid-repeat`
**Selector:** `[rweGridRepeat]`

Adds a responsive CSS grid repeat layout.

#### Input

| Name            | Type                | Description                         |
| --------------- | ------------------- | ----------------------------------- |
| `rweGridRepeat` | `string \| boolean` | Minimum column width or enable flag |

#### Example

```html
<div rweGridRepeat="18rem">...</div>
```

### [rweMint]

**Import:** `@rwe/unity-lib/mint`
**Selector:** `[rweMint]`

Adds a Unity mint-style left border accent.

#### Input

| Name      | Type                      | Description                    |
| --------- | ------------------------- | ------------------------------ |
| `rweMint` | `string \| false \| null` | Accent color or disabled state |

---

## Text And Interaction

### [rweTitle]

**Import:** `@rwe/unity-lib/title`
**Selector:** `[rweTitle]`

Pushes a scoped title into `RweTitleService` while the host exists.

#### Input

| Name       | Type             |
| ---------- | ---------------- |
| `rweTitle` | `string \| null` |

#### Example

```html
<section [rweTitle]="'Customers'"></section>
```

### [rweCopy] / [rweCopySilent]

**Import:** `@rwe/unity-lib/copy`
**Selectors:** `[rweCopy]`, `[rweCopySilent]`

Copies text to the clipboard on click.

#### Inputs

| Name            | Type  | Description                         |
| --------------- | ----- | ----------------------------------- |
| `rweCopy`       | `any` | Value to copy and show notification |
| `rweCopySilent` | `any` | Value to copy without notification  |

#### Example

```html
<button [rweCopy]="apiToken">Copy token</button>
<button [rweCopySilent]="id">Silent copy</button>
```

### [rweIcon]

**Import:** `@rwe/unity-lib/icon`
**Selector:** `[rweIcon]`

Auto-applies Unity icon font classes based on host content.

#### Notes

- Best used on inline elements with icon names as text content
- Useful for lightweight icon rendering without a dedicated component

### [rweShowTooltipIfTruncated]

**Import:** `@rwe/unity-lib/show-tooltip-if-truncated`
**Selector:** `[rweShowTooltipIfTruncated]`

Enables a Material tooltip only if the host text is actually truncated.

#### Typical usage

```html
<span [matTooltip]="label" rweShowTooltipIfTruncated>{{ label }}</span>
```

---

## Input Filtering And Inline Assets

### [rweFilterInput]

**Import:** `@rwe/unity-lib/filter-input`
**Selector:** `[rweFilterInput]`

Filters keyboard and paste input via a regular expression.

#### Input

| Name             | Type                                    | Description     |
| ---------------- | --------------------------------------- | --------------- |
| `rweFilterInput` | `string \| RegExp \| undefined \| null` | Allowed pattern |

#### Example

```html
<input rweFilterInput="^[0-9]*$" />
<input [rweFilterInput]="/^[a-zA-Z0-9]*$/" />
```

### [rweInlineSvg]

**Import:** `@rwe/unity-lib/inline-svg`
**Selector:** `[rweInlineSvg]`

Fetches an SVG file and injects the SVG markup into the host element.

#### Input

| Name           | Type     |
| -------------- | -------- |
| `rweInlineSvg` | `string` |

#### Example

```html
<span [rweInlineSvg]="'assets/icons/chart.svg'"></span>
```

---

## Guidance

Use directives when:

- The behavior should enhance native HTML or a third-party component
- You need low-level DOM interaction without wrapping another component
- The library already provides the behavior in a reusable, tested directive

Prefer components when:

- The feature has a dedicated Unity component API
- The interaction includes layout, styling, or accessibility behavior beyond a single host element
