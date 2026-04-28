# Unity Form Recipe

A complete, copy-paste form template that demonstrates all Unity form components, validators, layout, and error display patterns.

Use this as a starting point when building a new form. Remove fields that are not needed.

---

## Template (HTML)

```html
<div class="rwe-list-v">
  <rwe-card [centered]="true">
    <h2>Form Recipe</h2>
    <form rweGridRepeat="20rem" [style.overflow]="'auto'">
      <rwe-form-radio
        hint="Order faster"
        label="Existing customer?"
        [options]="existingCustomers | rweMapBy: existingCustomerToOption"
        [control]="controls.existingCustomer"
      />
      <rwe-form-toggle width="100%" [options]="experienceOptions" label="Experience Levels" hint="hint" />
      <rwe-form-select
        width="100%"
        label="Gender"
        [control]="controls.gender"
        [rweOptions]="genders"
        [rweOptionsLabels]="genderLabels"
        [canReset]="true"
      />
      <rwe-form-input width="100%" label="First Name" [control]="controls.firstName" [canReset]="true" />
      <rwe-form-input width="100%" label="Last Name" [control]="controls.lastName" [canReset]="true" />
      <rwe-form-datepicker width="100%" label="Birthday" [control]="controls.birthday" [canReset]="true" />
      <rwe-form-timepicker width="100%" label="Time" [control]="controls.time" [canReset]="true" />
      <rwe-form-input type="number" width="100%" label="Age" [control]="controls.age" [canReset]="true" />
      <rwe-form-autocomplete
        width="100%"
        label="Title"
        [control]="controls.title"
        [rweOptions]="titles"
        [rweOptionsLabels]="titleLabels"
        [canReset]="true"
      />
      <rwe-form-select-multi
        width="100%"
        label="Hobbies"
        [control]="controls.hobby"
        [rweOptions]="Hobby | rweObjectValues"
        [canReset]="true"
        rweOptionsSorted
      />
      <rwe-form-input type="email" width="100%" label="Email" [control]="controls.email" [canReset]="true" />
      <rwe-form-input type="tel" width="100%" label="Phone" [control]="controls.phone" hint="Include area code" [canReset]="true" />
      <rwe-form-input
        type="password"
        width="100%"
        label="Password"
        [control]="controlsPassword.password"
        hint="Length between 5 and 10"
        [canReset]="true"
      />
      <rwe-form-input
        type="password"
        width="100%"
        label="Confirm Password"
        hint="Length between 5 and 10"
        [canReset]="true"
        [control]="controlsPassword.passwordConfirm"
        [error]="formPassword.errors ? formPassword.errors[errorPasswordsSame] : null"
      />
      <div class="rwe-bar-h">
        <rwe-form-checkbox hint="Send via mail" label="Terms of use" [control]="controls.termsOfUse" />
        <rwe-form-slide-toggle label="Save password" hint="Must be true" [control]="controls.savePassword" />
      </div>
      <rwe-form-input
        style="grid-column: span 2"
        type="textarea"
        width="100%"
        label="Comment"
        [rows]="5"
        [control]="controls.comment"
        [canReset]="true"
      />
    </form>

    <div class="rwe-bar-h rwe-align-end rwe-padding-bottom-small">
      <rwe-button variant="outlined" (click)="form.reset(); form.markAllAsTouched()">Reset</rwe-button>
      <rwe-button variant="filled" [disabled]="form.invalid" (click)="submit()">Register</rwe-button>
    </div>
  </rwe-card>

  <rwe-card label="Form Value">
    <pre>{{ form.value | json }}</pre>
  </rwe-card>

  <rwe-card label="Form Errors Map By Key">
    <pre>{{ errorsByKey$ | async | json }}</pre>
  </rwe-card>

  <rwe-card label="Form Errors Map By Field">
    <pre>{{ errorsByField$ | async | json }}</pre>
  </rwe-card>
</div>
```

---

## Component (TypeScript)

```typescript
import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {AsyncPipe, JsonPipe} from '@angular/common';
import {FormControl, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {merge} from 'rxjs';
import {map} from 'rxjs/operators';

import {
  buildValidator,
  formErrorKeyMap,
  formErrorMap,
  validateDate,
  validateEmail,
  validateIdentity,
  validateMaxLen,
  validateMinLen,
  validateNumber,
  validateOptionMulti,
  validateRequired,
} from '@rwe/unity-lib/core';
import {RweButton} from '@rwe/unity-lib/button';
import {RweCard} from '@rwe/unity-lib/card';
import {RweFormAutocompleteComponent, RweFormAutocompleteOptionsDirective} from '@rwe/unity-lib/form-autocomplete';
import {RweFormCheckboxComponent} from '@rwe/unity-lib/form-checkbox';
import {RweFormDatepickerComponent} from '@rwe/unity-lib/form-datepicker';
import {RweFormInputComponent} from '@rwe/unity-lib/form-input';
import {RweFormRadioComponent} from '@rwe/unity-lib/form-radio';
import {valueToRweRadioItemWithNames} from '@rwe/unity-lib/form-radio';
import {RweFormSelectComponent, RweFormSelectOptionsDirective} from '@rwe/unity-lib/form-select';
import {RweFormSelectMultiComponent, RweFormSelectMultiOptionsDirective} from '@rwe/unity-lib/form-select-multi';
import {RweFormSlideToggleComponent} from '@rwe/unity-lib/form-slide-toggle';
import {RweFormTimepickerComponent} from '@rwe/unity-lib/form-timepicker';
import {RweFormToggleComponent, RweToggleItem} from '@rwe/unity-lib/form-toggle';
import {RweGridRepeatDirective} from '@rwe/unity-lib/grid-repeat';
import {RweMapByPipe, RweObjectValuesPipe} from '@rwe/unity-lib/common';
import {RweNotificationService} from '@rwe/unity-lib/notification';

export enum ExistingCustomer {
  yes = 0,
  no = 1,
}

export enum Hobby {
  tennis = 'tennis',
  soccer = 'soccer',
  football = 'football',
  baseball = 'baseball',
}

export type Title = 'bch' | 'msc' | 'phd';

@Component({
  selector: 'app-form-recipe',
  templateUrl: './form-recipe.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    JsonPipe,
    ReactiveFormsModule,
    RweButton,
    RweCard,
    RweFormAutocompleteComponent,
    RweFormAutocompleteOptionsDirective,
    RweFormDatepickerComponent,
    RweFormCheckboxComponent,
    RweFormInputComponent,
    RweFormRadioComponent,
    RweFormSelectComponent,
    RweFormSelectOptionsDirective,
    RweFormSelectMultiComponent,
    RweFormSelectMultiOptionsDirective,
    RweFormSlideToggleComponent,
    RweFormTimepickerComponent,
    RweFormToggleComponent,
    RweGridRepeatDirective,
    RweMapByPipe,
    RweObjectValuesPipe,
  ],
})
export class FormRecipe {
  readonly #notify = inject(RweNotificationService);

  readonly errorPasswordsSame = 'ErrorPasswordsSame';

  readonly #validators = {
    date: validateDate('Invalid date'),
    email: validateEmail('Invalid email'),
    nr: validateNumber('Invalid number'),
    required: validateRequired('Field is required'),
    samePassword: buildValidator(
      (ctrl) =>
        (!ctrl.value.password && !ctrl.value.passwordConfirm) ||
        ctrl.value.password === ctrl.value.passwordConfirm,
      this.errorPasswordsSame,
      'Passwords are different.',
    ),
  };

  readonly Hobby = Hobby;
  readonly genders = [1, 2, 3];
  readonly genderLabels = {1: 'Female', 2: 'Male', 3: 'Other'};
  readonly existingCustomers = [ExistingCustomer.yes, ExistingCustomer.no];
  readonly titles: Title[] = ['bch', 'msc', 'phd'];
  readonly titleLabels: Record<Title, string> = {bch: 'Bachelor', msc: 'Master', phd: 'Doctor'};

  readonly experienceOptions: RweToggleItem<number>[] = [
    {label: 'Entry-level', value: 1},
    {label: 'Mid-level', value: 2},
    {label: 'Senior', value: 3},
  ];

  readonly form = new FormGroup({
    age: new FormControl<number | null>(null, [this.#validators.required, this.#validators.nr]),
    birthday: new FormControl<Date | null>(null, [this.#validators.required, this.#validators.date]),
    time: new FormControl<Date | null>(null, []),
    comment: new FormControl<string | null>(null),
    email: new FormControl<string | null>(null, [this.#validators.required, this.#validators.email]),
    existingCustomer: new FormControl<ExistingCustomer | null>(ExistingCustomer.no, this.#validators.required),
    firstName: new FormControl<string | null>(null, this.#validators.required),
    gender: new FormControl<number | null>(null, this.#validators.required),
    hobby: new FormControl<Hobby[] | null>(null, [
      this.#validators.required,
      validateOptionMulti('Invalid hobby', Object.values(Hobby)),
    ]),
    lastName: new FormControl<string | null>(null, this.#validators.required),
    password: new FormGroup(
      {
        password: new FormControl<string | null>(null, [
          this.#validators.required,
          validateMinLen('Must be at least 5 characters', 5),
          validateMaxLen('Must be at most 10 characters', 10),
        ]),
        passwordConfirm: new FormControl<string | null>(null, [
          this.#validators.required,
          validateMinLen('Must be at least 5 characters', 5),
          validateMaxLen('Must be at most 10 characters', 10),
        ]),
      },
      this.#validators.samePassword,
    ),
    phone: new FormControl<string | null>({value: null, disabled: true}),
    termsOfUse: new FormControl<boolean | null>(null, [this.#validators.required, validateIdentity('Must accept', true)]),
    savePassword: new FormControl<boolean | null>(true, [this.#validators.required, validateIdentity('Must be true', true)]),
    title: new FormControl<string | null>(null),
  });

  readonly controls = this.form.controls;
  readonly formPassword = this.form.controls.password;
  readonly controlsPassword = this.formPassword.controls;

  readonly errorsByField$ = merge(this.form.statusChanges, this.form.valueChanges).pipe(
    map(() => formErrorMap(this.form)),
  );
  readonly errorsByKey$ = merge(this.form.statusChanges, this.form.valueChanges).pipe(
    map(() => formErrorKeyMap(this.form)),
  );

  readonly existingCustomerToOption = valueToRweRadioItemWithNames({
    [ExistingCustomer.no]: 'No',
    [ExistingCustomer.yes]: 'Yes',
  });

  submit(): void {
    this.#notify.success('Submitted.');
    this.form.reset();
  }
}
```
