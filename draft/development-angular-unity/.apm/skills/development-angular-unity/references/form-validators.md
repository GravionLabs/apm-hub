# Unity Form Validators Reference

All Unity validators are imported from `@rwe/unity-lib/core`. Each validator accepts the user-facing error message as its **first** argument. Unity form components display the error automatically via `[control]` binding — no custom error template is needed.

---

## Field Validators

```typescript
import {
  validateRequired,
  validateMinLen,
  validateMaxLen,
  validateEmail,
  validateNumber,
  validateDate,
  validateRegex,
  validateIdentity,
  validateOptionMulti,
  buildValidator,
} from '@rwe/unity-lib/core';
```

| Validator             | Signature                                                          | Notes                                              |
|-----------------------|--------------------------------------------------------------------|----------------------------------------------------|
| `validateRequired`    | `(message: string)`                                                | Replaces `Validators.required`                     |
| `validateMinLen`      | `(message: string, min: number)`                                   | Minimum character length                           |
| `validateMaxLen`      | `(message: string, max: number)`                                   | Maximum character length                           |
| `validateEmail`       | `(message: string)`                                                | Email format validation                            |
| `validateNumber`      | `(message: string)`                                                | Must be a numeric value                            |
| `validateDate`        | `(message: string)`                                                | Must be a valid date                               |
| `validateRegex`       | `(message: string, pattern: RegExp, allowEmpty?: boolean)`         | Pattern match; skips empty values by default       |
| `validateIdentity`    | `(message: string, value: unknown)`                                | Exact value match (e.g. `true` for accept checkbox)|
| `validateOptionMulti` | `(message: string, options: unknown[])`                            | Multi-select: each selected value must be in list  |

### `validateRegex` — `allowEmpty`

The third `allowEmpty` argument (default `true`) controls whether empty values skip the pattern check:

```typescript
// Skips validation when empty (default)
validateRegex('Lowercase letters and hyphens only', /^[a-z0-9-]+$/)

// Always validates — combine with validateRequired to enforce both
validateRegex('Lowercase letters and hyphens only', /^[a-z0-9-]+$/, false)
```

---

## Cross-Field Validators — `buildValidator`

Use `buildValidator` on a parent `FormGroup` when validation depends on multiple sibling controls (e.g. confirm password).

```typescript
import {buildValidator} from '@rwe/unity-lib/core';

const errorPasswordsSame = 'ErrorPasswordsSame';

const samePassword = buildValidator(
  (ctrl) =>
    (!ctrl.value.password && !ctrl.value.passwordConfirm) ||
    ctrl.value.password === ctrl.value.passwordConfirm,
  errorPasswordsSame,
  'Passwords are different.',
);

readonly formPassword = new FormGroup(
  {
    password: new FormControl<string | null>(null, [
      validateRequired('Required'),
      validateMinLen('Must be at least 5 characters', 5),
      validateMaxLen('Must be at most 10 characters', 10),
    ]),
    passwordConfirm: new FormControl<string | null>(null, [
      validateRequired('Required'),
      validateMinLen('Must be at least 5 characters', 5),
      validateMaxLen('Must be at most 10 characters', 10),
    ]),
  },
  samePassword,
);
```

Render the cross-field error on the confirm input using `[error]`:

```html
<rwe-form-input
  type="password"
  width="100%"
  label="Confirm Password"
  [control]="formPassword.controls.passwordConfirm"
  [error]="formPassword.errors ? formPassword.errors[errorPasswordsSame] : null"
  [canReset]="true"
/>
```

---

## Error Map Helpers

Use these to observe all form errors reactively, e.g. for a debug panel or API error mapping.

```typescript
import {formErrorMap, formErrorKeyMap} from '@rwe/unity-lib/core';
import {merge} from 'rxjs';
import {map} from 'rxjs/operators';

// Errors keyed by error type (e.g. { required: 'Field is required' })
readonly errorsByKey$ = merge(this.form.statusChanges, this.form.valueChanges).pipe(
  map(() => formErrorKeyMap(this.form)),
);

// Errors keyed by field name (e.g. { email: 'Invalid email' })
readonly errorsByField$ = merge(this.form.statusChanges, this.form.valueChanges).pipe(
  map(() => formErrorMap(this.form)),
);
```
