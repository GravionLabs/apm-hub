# Unity Form Components Reference

Complete API reference for all Unity form components from `@rwe/unity-lib`.

Use this file when you need the exact imports, inputs, option-binding patterns, and usage examples for each component.

---

## rwe-form-input

**Import:** `@rwe/unity-lib/form-input`
**Class:** `RweFormInputComponent`

General-purpose text, number, email, tel, password, and textarea field.

### Inputs

| Name       | Type                                                          | Default  | Description                          |
|------------|---------------------------------------------------------------|----------|--------------------------------------|
| `control`  | `FormControl`                                                 | required | Reactive form control                |
| `label`    | `string`                                                      | —        | Field label                          |
| `type`     | `'text' \| 'number' \| 'email' \| 'tel' \| 'password' \| 'textarea'` | `'text'` | Input type |
| `width`    | `string`                                                      | —        | CSS width, e.g. `'100%'`             |
| `hint`     | `string`                                                      | —        | Helper text below the field          |
| `canReset` | `boolean`                                                     | `false`  | Show clear button                    |
| `rows`     | `number`                                                      | —        | Row count for `type="textarea"`      |
| `error`    | `string \| null`                                              | —        | External error message (cross-field) |

### Usage

```html
<rwe-form-input width="100%" label="First Name" [control]="controls.firstName" [canReset]="true" />
<rwe-form-input type="email" width="100%" label="Email" [control]="controls.email" [canReset]="true" />
<rwe-form-input type="textarea" width="100%" label="Comment" [rows]="5" [control]="controls.comment" [canReset]="true" />
```

---

## rwe-form-select

**Import:** `@rwe/unity-lib/form-select`
**Classes:** `RweFormSelectComponent`, `RweFormSelectOptionsDirective`

Single-value select dropdown. Options are bound via `[rweOptions]` + optional `[rweOptionsLabels]`.

### Inputs

| Name               | Type                     | Default | Description                              |
|--------------------|--------------------------|---------|------------------------------------------|
| `control`          | `FormControl`            | required | Reactive form control                   |
| `label`            | `string`                 | —        | Field label                             |
| `width`            | `string`                 | —        | CSS width                               |
| `rweOptions`       | `T[]`                    | required | Array of option values                  |
| `rweOptionsLabels` | `Record<T, string>`      | —        | Display labels for each option value    |
| `canReset`         | `boolean`                | `false`  | Show clear button                       |

### Usage

```typescript
readonly genders = [1, 2, 3];
readonly genderLabels = {1: 'Female', 2: 'Male', 3: 'Other'};
```

```html
<rwe-form-select
  width="100%"
  label="Gender"
  [control]="controls.gender"
  [rweOptions]="genders"
  [rweOptionsLabels]="genderLabels"
  [canReset]="true"
/>
```

---

## rwe-form-select-multi

**Import:** `@rwe/unity-lib/form-select-multi`
**Classes:** `RweFormSelectMultiComponent`, `RweFormSelectMultiOptionsDirective`

Multi-value select. The control value is an array.

### Inputs

| Name              | Type              | Default | Description                        |
|-------------------|-------------------|---------|------------------------------------|
| `control`         | `FormControl`     | required | Reactive form control (array)     |
| `label`           | `string`          | —        | Field label                       |
| `width`           | `string`          | —        | CSS width                         |
| `rweOptions`      | `T[]`             | required | Array of option values            |
| `canReset`        | `boolean`         | `false`  | Show clear button                 |
| `rweOptionsSorted`| directive (attr)  | —        | Sorts options alphabetically      |

### Usage

```typescript
export enum Hobby {
  tennis = 'tennis',
  soccer = 'soccer',
}
```

```html
<rwe-form-select-multi
  width="100%"
  label="Hobbies"
  [control]="controls.hobby"
  [rweOptions]="Hobby | rweObjectValues"
  [canReset]="true"
  rweOptionsSorted
/>
```

---

## rwe-form-autocomplete

**Import:** `@rwe/unity-lib/form-autocomplete`
**Classes:** `RweFormAutocompleteComponent`, `RweFormAutocompleteOptionsDirective`

Autocomplete text field with option matching.

### Inputs

| Name               | Type                | Default  | Description                           |
|--------------------|---------------------|----------|---------------------------------------|
| `control`          | `FormControl`       | required | Reactive form control                 |
| `label`            | `string`            | —        | Field label                           |
| `width`            | `string`            | —        | CSS width                             |
| `rweOptions`       | `T[]`               | required | Array of option values                |
| `rweOptionsLabels` | `Record<T, string>` | —        | Display labels mapped to option values|
| `canReset`         | `boolean`           | `false`  | Show clear button                     |

### Usage

```typescript
export type Title = 'bch' | 'msc' | 'phd';
readonly titles: Title[] = ['bch', 'msc', 'phd'];
readonly titleLabels: Record<Title, string> = {bch: 'Bachelor', msc: 'Master', phd: 'Doctor'};
```

```html
<rwe-form-autocomplete
  width="100%"
  label="Title"
  [control]="controls.title"
  [rweOptions]="titles"
  [rweOptionsLabels]="titleLabels"
  [canReset]="true"
/>
```

---

## rwe-form-datepicker

**Import:** `@rwe/unity-lib/form-datepicker`
**Class:** `RweFormDatepickerComponent`

Date picker. Control value is `Date | null`.

### Inputs

| Name       | Type          | Default  | Description             |
|------------|---------------|----------|-------------------------|
| `control`  | `FormControl` | required | Reactive form control   |
| `label`    | `string`      | —        | Field label             |
| `width`    | `string`      | —        | CSS width               |
| `canReset` | `boolean`     | `false`  | Show clear button       |

### Usage

```typescript
birthday: new FormControl<Date | null>(null, [validateRequired('Required'), validateDate('Invalid date')]),
```

```html
<rwe-form-datepicker width="100%" label="Birthday" [control]="controls.birthday" [canReset]="true" />
```

---

## rwe-form-timepicker

**Import:** `@rwe/unity-lib/form-timepicker`
**Class:** `RweFormTimepickerComponent`

Time picker. Control value is `Date | null`.

### Inputs

| Name       | Type          | Default  | Description           |
|------------|---------------|----------|-----------------------|
| `control`  | `FormControl` | required | Reactive form control |
| `label`    | `string`      | —        | Field label           |
| `width`    | `string`      | —        | CSS width             |
| `canReset` | `boolean`     | `false`  | Show clear button     |

### Usage

```html
<rwe-form-timepicker width="100%" label="Time" [control]="controls.time" [canReset]="true" />
```

---

## rwe-form-radio

**Import:** `@rwe/unity-lib/form-radio`
**Class:** `RweFormRadioComponent`

Radio button group. Options are `RweRadioItem<T>[]` passed via `[options]`.

### Inputs

| Name      | Type                | Default  | Description                       |
|-----------|---------------------|----------|-----------------------------------|
| `control` | `FormControl`       | required | Reactive form control             |
| `label`   | `string`            | —        | Group label                       |
| `hint`    | `string`            | —        | Helper text                       |
| `options` | `RweRadioItem<T>[]` | required | Radio options (label + value)     |

### Usage

```typescript
import {valueToRweRadioItemWithNames} from '@rwe/unity-lib/form-radio';

export enum ExistingCustomer { yes = 0, no = 1 }

readonly existingCustomers = [ExistingCustomer.yes, ExistingCustomer.no];
readonly existingCustomerToOption = valueToRweRadioItemWithNames({
  [ExistingCustomer.no]: 'No',
  [ExistingCustomer.yes]: 'Yes',
});
```

```html
<rwe-form-radio
  label="Existing customer?"
  hint="Order faster"
  [options]="existingCustomers | rweMapBy: existingCustomerToOption"
  [control]="controls.existingCustomer"
/>
```

---

## rwe-form-toggle

**Import:** `@rwe/unity-lib/form-toggle`
**Class:** `RweFormToggleComponent`

Segmented toggle bar. Options are `RweToggleItem<T>[]`.

### Inputs

| Name      | Type                 | Default  | Description           |
|-----------|----------------------|----------|-----------------------|
| `options` | `RweToggleItem<T>[]` | required | Toggle options        |
| `label`   | `string`             | —        | Label                 |
| `hint`    | `string`             | —        | Helper text           |
| `width`   | `string`             | —        | CSS width             |

### Usage

```typescript
import {RweToggleItem} from '@rwe/unity-lib/form-toggle';

readonly experienceOptions: RweToggleItem<number>[] = [
  {label: 'Entry-level', value: 1},
  {label: 'Mid-level', value: 2},
  {label: 'Senior', value: 3},
];
```

```html
<rwe-form-toggle width="100%" label="Experience Level" hint="Select one" [options]="experienceOptions" />
```

---

## rwe-form-checkbox

**Import:** `@rwe/unity-lib/form-checkbox`
**Class:** `RweFormCheckboxComponent`

Single checkbox. Control value is `boolean | null`.

### Inputs

| Name      | Type          | Default  | Description           |
|-----------|---------------|----------|-----------------------|
| `control` | `FormControl` | required | Reactive form control |
| `label`   | `string`      | —        | Label                 |
| `hint`    | `string`      | —        | Helper text           |

### Usage

```html
<rwe-form-checkbox hint="Send via mail" label="Terms of use" [control]="controls.termsOfUse" />
```

---

## rwe-form-slide-toggle

**Import:** `@rwe/unity-lib/form-slide-toggle`
**Class:** `RweFormSlideToggleComponent`

On/off slide toggle. Control value is `boolean | null`.

### Inputs

| Name      | Type          | Default  | Description           |
|-----------|---------------|----------|-----------------------|
| `control` | `FormControl` | required | Reactive form control |
| `label`   | `string`      | —        | Label                 |
| `hint`    | `string`      | —        | Helper text           |

### Usage

```html
<rwe-form-slide-toggle label="Save password" hint="Must be true" [control]="controls.savePassword" />
```
