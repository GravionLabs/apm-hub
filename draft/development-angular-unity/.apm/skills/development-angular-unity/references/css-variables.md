# RWE Unity CSS Variables

Reference for the main CSS custom properties exposed by Unity.

These variables back the library theme, spacing scale, typography, and utility classes.

---

## Brand Colors

Brand variables follow the `--rwe-brand-*` convention.

### Primary brand values

```css
--rwe-brand-blue: #1d4477;
--rwe-brand-energyblue: #00b1eb;
--rwe-brand-energydarkgreen: #00a19f;
--rwe-brand-energylightgreen: #3ed8c3;
--rwe-brand-sand: #e8e8e4;
--rwe-brand-black: #000000;
--rwe-brand-white: #ffffff;
```

### Accent families

```css
--rwe-brand-accentorange: #ef7d00;
--rwe-brand-accentorange-1: #f39e40;
--rwe-brand-accentorange-2: #f7be80;
--rwe-brand-accentorange-3: #fbdfbf;

--rwe-brand-accentdarkred: #b61f34;
--rwe-brand-accentdarkred-1: #c85767;
--rwe-brand-accentdarkred-2: #db8f9a;
--rwe-brand-accentdarkred-3: #edc7cc;

--rwe-brand-accentgreen: #005e65;
--rwe-brand-accentgreen-1: #40868b;
--rwe-brand-accentgreen-2: #80afb2;
--rwe-brand-accentgreen-3: #bfd7d8;

--rwe-brand-accentyellow: #ffcc00;
--rwe-brand-accentyellow-1: #ffd940;
--rwe-brand-accentyellow-2: #ffe580;
--rwe-brand-accentyellow-3: #fff2bf;

--rwe-brand-accentlightred: #e7343f;
--rwe-brand-accentlightred-1: #ed676f;
--rwe-brand-accentlightred-2: #f39a9f;
--rwe-brand-accentlightred-3: #f9cccf;

--rwe-brand-accentlightgreen: #5ab88f;
--rwe-brand-accentlightgreen-1: #84caab;
--rwe-brand-accentlightgreen-2: #addcc7;
--rwe-brand-accentlightgreen-3: #d6ede3;

--rwe-brand-accentlightgray: #adafb1;
--rwe-brand-accentlightgray-1: #c2c3c4;
--rwe-brand-accentlightgray-2: #d6d7d8;
--rwe-brand-accentlightgray-3: #ebebeb;

--rwe-brand-accentdarkgray: #52555c;
--rwe-brand-accentdarkgray-1: #7d7f85;
--rwe-brand-accentdarkgray-2: #a8aaad;
--rwe-brand-accentdarkgray-3: #d4d4d6;
```

---

## Semantic Colors

Semantic variables adapt to the active theme mode.

```css
/* Light mode / default */
--rwe-color-primary: var(--mat-sys-primary);
--rwe-color-secondary: var(--rwe-brand-energydarkgreen);
--rwe-color-active: var(--mat-sys-primary);
--rwe-color-surface: var(--rwe-brand-white);
--rwe-color-background: var(--rwe-color-surface);
--rwe-color-disabled: var(--rwe-brand-accentlightgray-2);
--rwe-color-divider: var(--mat-sys-outline-variant);
--rwe-color-hint: var(--rwe-brand-accentdarkgray-1);
--rwe-color-hover: #edf0f4;
--rwe-color-icon: var(--rwe-brand-blue);
--rwe-color-inactive: var(--rwe-brand-accentdarkgray-1);
--rwe-color-link: #007ea8;
--rwe-color-link-hover: color-mix(in srgb, var(--rwe-color-link) 75%, #fff 25%);
--rwe-color-shadow: var(--rwe-brand-accentdarkgray-2);
--rwe-color-text: var(--rwe-brand-blue);
--rwe-color-success: var(--rwe-brand-energydarkgreen);
--rwe-color-error: var(--rwe-brand-accentdarkred);
--rwe-color-warning: #917300;

/* Dark mode overrides */
--rwe-color-surface: var(--rwe-palette-darkblue-3);
--rwe-color-background: var(--rwe-color-surface);
--rwe-color-disabled: var(--rwe-palette-darkblue-1);
--rwe-color-hint: var(--rwe-brand-accentlightgray-1);
--rwe-color-hover: var(--rwe-palette-transparent-3);
--rwe-color-icon: var(--rwe-brand-white);
--rwe-color-inactive: var(--rwe-brand-accentlightgray);
--rwe-color-link: var(--mat-sys-primary);
--rwe-color-link-hover: color-mix(in srgb, var(--rwe-color-link) 75%, #fff 25%);
--rwe-color-shadow: var(--rwe-palette-darkblue-5);
--rwe-color-text: var(--rwe-brand-accentlightgray-1);
--rwe-color-success: var(--rwe-brand-energydarkgreen);
--rwe-color-error: var(--rwe-brand-accentlightred-1);
--rwe-color-warning: var(--rwe-brand-accentyellow-2);

/* Contrast mode overrides */
--rwe-color-secondary: var(--rwe-brand-accentlightgreen);
--rwe-color-surface: var(--rwe-brand-black);
--rwe-color-background: var(--rwe-color-surface);
--rwe-color-disabled: var(--rwe-brand-accentdarkgray);
--rwe-color-hint: var(--rwe-brand-accentlightgray-1);
--rwe-color-hover: var(--rwe-brand-accentdarkgray);
--rwe-color-icon: var(--rwe-brand-white);
--rwe-color-inactive: var(--rwe-brand-accentlightgray);
--rwe-color-link: var(--rwe-brand-white);
--rwe-color-link-hover: color-mix(in srgb, var(--rwe-color-link) 75%, #000 25%);
--rwe-color-shadow: var(--rwe-brand-white);
--rwe-color-text: var(--rwe-brand-white);
--rwe-color-success: var(--rwe-brand-accentlightgreen);
--rwe-color-error: var(--rwe-brand-accentlightred-1);
--rwe-color-warning: var(--rwe-brand-accentyellow-2);
```

Use semantic variables in app styles wherever possible instead of hard-coded brand colors.

---

## Palette Variables

Unity also publishes palette helpers used internally by themes.

### Concrete values

```css
--rwe-palette-darkblue-1: #2a3a4e;
--rwe-palette-darkblue-2: #1a293e;
--rwe-palette-darkblue-3: #162436;
--rwe-palette-darkblue-4: #0b1a2d;
--rwe-palette-darkblue-5: #0e1723;

--rwe-palette-transparent-1: rgb(255 255 255 / 20%);
--rwe-palette-transparent-2: rgb(0 0 0 / 4%);
--rwe-palette-transparent-3: rgb(255 255 255 / 10%);
--rwe-palette-transparent-4: rgb(255 255 255 / 4%);
--rwe-palette-transparent-5: rgb(33 33 33 / 4%);
```

---

## Spacing Scale

### Gap

```css
--rwe-gap-zero: 0;
--rwe-gap-small: 0.5rem;
--rwe-gap-medium: 1rem;
--rwe-gap-large: 1.5rem;
```

### Padding

```css
--rwe-padding-zero: 0;
--rwe-padding-small: 1rem;
--rwe-padding-medium: 1.875rem;
--rwe-padding-large: 2.75rem;
```

### Margin

```css
--rwe-margin-zero: 0;
--rwe-margin-small: 0.5rem;
--rwe-margin-medium: 1rem;
--rwe-margin-large: 1.5rem;
```

These values are used by many Unity utility classes.

---

## Typography

### Font families

```css
--rwe-font-family-light: "RWESansWeb-Light";
--rwe-font-family-regular: "RWESansWeb-Regular";
--rwe-font-family-medium: "RWESansWeb-Medium";
--rwe-font-family-bold: "RWESansWeb-Bold";
```

### Font sizes

```css
--rwe-font-size-small: 0.6875rem;
--rwe-font-size-smaller: 0.8125rem;
--rwe-font-size-medium: 16px;
--rwe-font-size-bigger: 1.5rem;
--rwe-font-size-big: 2.125rem;
```

Use the variables directly for custom CSS or indirectly via utility classes such as `rwe-font-size-small`.

---

## Shape And Radius

```css
--rwe-border-radius-medium: 12px;
```

This is the common corner radius used by cards, sheets, and related utilities.

---

## Theme Modes

Unity toggles global theme classes on the `<body>` element.

| Theme    | Class                  |
| -------- | ---------------------- |
| Light    | `energy-light-mode`    |
| Dark     | `energy-dark-mode`     |
| Contrast | `energy-contrast-mode` |

Switching themes updates semantic colors while brand constants remain stable.

---

## Practical Usage

### Surface panel

```css
.customer-panel {
  background: var(--rwe-color-surface);
  color: var(--rwe-color-text);
  border-radius: var(--rwe-border-radius-medium);
  padding: var(--rwe-padding-medium);
  box-shadow: 0 8px 24px var(--rwe-color-shadow);
}
```

### Link styling

```css
.customer-link {
  color: var(--rwe-color-link);
}

.customer-link:hover {
  color: var(--rwe-color-link-hover);
}
```

### Brand-accented area

```css
.hero-strip {
  background: linear-gradient(
    135deg,
    var(--rwe-brand-blue),
    var(--rwe-brand-energyblue)
  );
  color: var(--rwe-brand-white);
}
```
