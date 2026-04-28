# RWE Unity CSS Utility Classes

Reference for the main `rwe-*` utility classes provided by Unity theming.

These classes live in the theming layer and are intended for fast, consistent application layouts.

---

## Layout

### Flex lists and bars

| Class                   | Effect                            |
| ----------------------- | --------------------------------- |
| `rwe-list-h`            | Horizontal flex list              |
| `rwe-list-v`            | Vertical flex list                |
| `rwe-bar-h`             | Horizontal bar with aligned items |
| `rwe-bar-v`             | Vertical bar                      |
| `rwe-list-item-content` | Content wrapper for list items    |
| `rwe-sheet`             | Sheet/card-like container         |

#### Example

```html
<div class="rwe-list-h rwe-gap-medium">
  <span>A</span>
  <span>B</span>
</div>
```

### Grid and fill helpers

| Class                     | Effect                   |
| ------------------------- | ------------------------ |
| `rwe-grid-repeat`         | Auto-fit responsive grid |
| `rwe-match-parent`        | Stretch to parent bounds |
| `rwe-match-parent-top`    | Match parent top         |
| `rwe-match-parent-right`  | Match parent right       |
| `rwe-match-parent-bottom` | Match parent bottom      |
| `rwe-match-parent-left`   | Match parent left        |
| `rwe-align-end`           | Align to end             |
| `rwe-hide`                | Hide element             |

---

## Typography

### Font sizes

| Class                   | Meaning               |
| ----------------------- | --------------------- |
| `rwe-font-size-small`   | Smallest utility text |
| `rwe-font-size-smaller` | Small body text       |
| `rwe-font-size-medium`  | Default text size     |
| `rwe-font-size-bigger`  | Large text            |
| `rwe-font-size-big`     | Headline size         |

### Text styles

| Class           | Meaning         |
| --------------- | --------------- |
| `rwe-code`      | Code-style text |
| `rwe-icon-font` | Icon font style |

### Important-force variants

Most typography utilities also exist as `rwe-force-*` variants if `!important` is required in integration-heavy screens.

---

## Spacing

Unity provides a predictable spacing scale: `zero`, `small`, `medium`, `large`.

### Padding

| Pattern    | Example                     |
| ---------- | --------------------------- |
| All sides  | `rwe-padding-medium`        |
| Horizontal | `rwe-padding-h-small`       |
| Vertical   | `rwe-padding-v-large`       |
| Top        | `rwe-padding-top-small`     |
| Bottom     | `rwe-padding-bottom-medium` |
| Left       | `rwe-padding-left-large`    |
| Right      | `rwe-padding-right-small`   |

Alternative naming variants also exist, for example:

- `rwe-padding-small-top`
- `rwe-padding-medium-bottom`
- `rwe-padding-large-h`

### Margin

| Pattern    | Example                    |
| ---------- | -------------------------- |
| All sides  | `rwe-margin-medium`        |
| Horizontal | `rwe-margin-h-small`       |
| Vertical   | `rwe-margin-v-large`       |
| Top        | `rwe-margin-top-small`     |
| Bottom     | `rwe-margin-bottom-medium` |
| Left       | `rwe-margin-left-large`    |
| Right      | `rwe-margin-right-small`   |

`rwe-force-*` variants also exist for spacing helpers.

#### Example

```html
<section class="rwe-sheet rwe-padding-medium rwe-margin-bottom-medium">
  Content
</section>
```

---

## Decoration And Surface

| Class                             | Effect                 |
| --------------------------------- | ---------------------- |
| `rwe-shadow`                      | Unity shadow treatment |
| `rwe-border-radius-medium`        | Medium radius          |
| `rwe-background-color-background` | App background color   |
| `rwe-background-color-surface`    | Surface/card color     |

### Decorative classes

| Class                                | Effect                        |
| ------------------------------------ | ----------------------------- |
| `rwe-deco-bottom-right`              | Decorative image position     |
| `rwe-deco-bottom-right-with-padding` | Decorative image plus spacing |
| `rwe-deco-top-right`                 | Decorative image top-right    |
| `rwe-deco-top-right-with-padding`    | Decorative image plus spacing |
| `rwe-deco-svg-left`                  | SVG deco left                 |
| `rwe-deco-svg-right`                 | SVG deco right                |
| `rwe-deco-svg-bottom-left`           | SVG deco bottom-left          |
| `rwe-deco-svg-bottom-right`          | SVG deco bottom-right         |
| `rwe-deco-svg-top-left`              | SVG deco top-left             |
| `rwe-deco-svg-top-right`             | SVG deco top-right            |

---

## Animations

| Class                             | Effect                          |
| --------------------------------- | ------------------------------- |
| `rwe-animation-enter-appear`      | Fade in                         |
| `rwe-animation-enter-left`        | Enter from left                 |
| `rwe-animation-leave-disappear`   | Fade out                        |
| `rwe-animation-leave-bottom`      | Leave to bottom                 |
| `rwe-animation-leave-right`       | Leave to right                  |
| `rwe-animation-rotate-x`          | Rotation animation              |
| `rwe-animation-scale-up-down`     | Scale pulse                     |
| `rwe-animation-scale-big-up-down` | Larger scale pulse              |
| `rwe-animation-wobble-x`          | Horizontal wobble               |
| `rwe-notification-animate`        | Notification entrance animation |

Use these sparingly for emphasis and transitions.

---

## Validation And Hints

| Class            | Effect             |
| ---------------- | ------------------ |
| `rwe-hint-error` | Error hint styling |

---

## Practical Combinations

### Responsive card grid

```html
<div class="rwe-grid-repeat rwe-gap-medium">
  <div class="rwe-sheet rwe-padding-medium">Card 1</div>
  <div class="rwe-sheet rwe-padding-medium">Card 2</div>
</div>
```

### Toolbar row

```html
<header class="rwe-bar-h rwe-padding-h-medium rwe-padding-v-small">
  <div class="rwe-list-h rwe-gap-medium">...</div>
</header>
```

### Empty-state panel

```html
<section
  class="rwe-sheet rwe-padding-large rwe-border-radius-medium rwe-shadow"
>
  <rwe-state-message messageType="info"></rwe-state-message>
</section>
```
