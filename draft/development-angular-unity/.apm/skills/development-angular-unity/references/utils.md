# RWE Unity Utilities And Pipes

Reference for utility pipes, helper classes, decorators, and common low-level APIs from `@rwe/unity-lib`.

---

## Core Utility Types

### RweOption

**Import:** exposed through form-related packages

```ts
interface RweOption<T> {
  label?: string;
  value: T;
}
```

Used by:

- `RweSelectItem<T>`
- `RweSelectMultiItem<T>`
- `RweAutocompleteItem<T>`
- `RweAutocompleteChipsItem<T>`
- `RweRadioItem<T>`

### HttpRequestWrap

**Import:** `@rwe/unity-lib/core`

```ts
interface HttpRequestWrap<T> {
  body?: T;
  busy: boolean;
  error?: unknown;
}
```

Use with `rwe-http-request-wrap-frame` to model request lifecycle state.

---

## Subjects And Reactive Helpers

### StateSubject

**Import:** `@rwe/unity-lib/core`

BehaviorSubject variant that only emits when the new value is actually different.

```ts
class StateSubject<T> extends BehaviorSubject<T> {
  constructor(value: T, checkJsonEquality = false);
  override next(value: T): void;
}
```

Use when you want `BehaviorSubject` semantics without duplicate emissions.

### ArraySubject

**Import:** `@rwe/unity-lib/core`

BehaviorSubject specialised for arrays.

```ts
class ArraySubject<T> extends BehaviorSubject<T[]> {
  add(...values: T[]): void;
  remove(...values: T[]): void;
}
```

Use it for selected items, active actions, or dynamically registered slots.

### Reactive Operators

**Import:** `@rwe/unity-lib/core`

Unity ships a few reusable RxJS helpers used across the library.

#### Common operators

- `plusWhenTriggeredWith<T>`
- `plux<T, K>`
- `shareAllReplayLast<T>`

Use these when extending patterns that already exist in the library source.

---

## Decorators And Error Helpers

### @RweDestroy()

**Import:** `@rwe/unity-lib/core`

Decorator that auto-completes `Subject`s and unsubscribes subscription-like members during `ngOnDestroy`.

```ts
const RweDestroyFunction = "ngOnDestroy";

function RweDestroy(): PropertyDecorator;
```

#### Example

```ts
@RweDestroy() private readonly destroy$ = new Subject<void>();
@RweDestroy() private readonly subscription = someObservable.subscribe();
```

#### Notes

- Patches or creates `ngOnDestroy()` on the class prototype
- Works with `Subject` and subscription-like objects
- Warns on invalid targets

### errorToString

**Import:** `@rwe/unity-lib/core`

Formats errors into user-facing strings.

Useful with:

- `HttpErrorResponse`
- plain `Error`
- raw strings
- custom handler chains

Use it when rendering consistent API error messages.

---

## Common Pipes

**Import:** `@rwe/unity-lib/common`

The `common` package exports a large collection of pipes. The most relevant groups are below.

### Array And Collection Pipes

- `RweFilterByPipe`
- `RweFindByPipe`
- `RweIncludesItemPipe`
- `RweIncludesAllOfPipe`
- `RweIncludesAnyOfPipe`
- `RweMapByPipe`
- `RweSortByPipe`
- `RweArrayJoinPipe`
- `RweArrayIncludesPipe`
- `RweObjectEntriesPipe`
- `RweObjectKeysPipe`
- `RweObjectValuesPipe`

#### Typical usage

```html
<div>{{ users | rweFilterBy: isActive }}</div>
<div>{{ tags | rweArrayJoin:', ' }}</div>
```

### Form And Validation Pipes

- `RweFirstFormErrorPipe`
- `RweFormErrorsPipe`
- `RweDatepickerSpecialErrorPipe`
- `RweTimepickerSpecialErrorPipe`

Use these for rendering validation feedback from Angular forms and Unity date/time controls.

### Utility Pipes

- `RweApplyFnPipe`
- `RweMapToTextPipe`
- `RweDurationPipe`
- `RweJsonMergeNestedPipe`
- `RweRandomBetweenPipe`
- `RweAsStringPipe`
- `RweAsStringOrEmptyPipe`

#### Typical usage

```html
<span>{{ durationMs | rweDuration }}</span>
<span>{{ value | rweApplyFn: formatter }}</span>
```

### String Pipes

- `RweStrToLowerCasePipe`
- `RweStrToUpperCasePipe`
- `RweStrTrimPipe`
- `RweStrIncludesPipe`
- `RweStrSplitPipe`
- `RweStrReplacePipe`
- `RwePadStartZero2Pipe`
- `RwePadStartZero4Pipe`

### Math Pipes

- `RweAddPipe`
- `RweSubtractPipe`
- `RweMultiplyPipe`
- `RweDividePipe`

#### Typical usage

```html
<span>{{ price | rweMultiply: vat }}</span>
```

---

## Date Pipes

Unity exposes an unusually rich date utility layer through `@rwe/unity-lib/common`.

### Common categories

**Add operations**

- `RweAddDaysPipe`
- `RweAddHoursPipe`
- `RweAddMinutesPipe`
- `RweAddWeeksPipe`
- `RweAddLocalMonthsPipe`
- `RweAddUtcMonthsPipe`
- `RweAddLocalYearsPipe`
- `RweAddUtcYearsPipe`

**Formatting and conversion**

- `RweAsDatePipe`
- `RweAsIsoPipe`
- `RweAsLocalDateTimePipe`
- `RweAsUtcDateTimePipe`
- `RweDateCopyPipe`
- `RweDateToLocalDatePartPipe`
- `RweDateToUtcDatePartPipe`
- `RweDateToLocalHhMmPartPipe`

**Boundary operations**

- `RweDateStartOfLocalDayPipe`
- `RweDateEndOfLocalDayPipe`
- `RweDateStartOfUtcDayPipe`
- `RweDateEndOfUtcDayPipe`
- Month, quarter, half-year, year, hour, minute, second, and work-week variants

**Parsing helpers**

- ISO-to-date-part helpers
- local/UTC time-part helpers

Use these when the project already follows Unity’s date pipeline instead of Angular `DatePipe` or ad hoc helpers.

---

## Nodom Utilities

The `nodom` area provides server-safe pure utilities with no DOM dependencies.

### Common helpers

- `jsonEqual()`
- `jsonCopy()`
- `compose()`
- date helper functions
- string helper functions
- math helper functions

Use these when you need shared pure functions that should also work in SSR or non-browser contexts.

---

## Practical Patterns

### Format first validation error

```html
<span class="rwe-hint-error">{{ control.errors | rweFirstFormError }}</span>
```

### Use a utility pipe to derive display text

```html
<span>{{ item | rweMapToText }}</span>
```

### Use StateSubject in a service

```ts
@Injectable({ providedIn: "root" })
export class CustomerFilterStore {
  readonly filter$ = new StateSubject<string>("");
}
```
