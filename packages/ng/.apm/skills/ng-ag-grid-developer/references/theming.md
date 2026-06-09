# AG Grid — Theming & Layout

## Built-in Themes

| Theme class | Style |
|---|---|
| `ag-theme-quartz` | Modern, clean (recommended for new projects) |
| `ag-theme-alpine` | Flat, minimal |
| `ag-theme-balham` | Compact, data-dense |
| `ag-theme-material` | Material Design |

Apply the theme class to the `<ag-grid-angular>` element:

```html
<ag-grid-angular
  class="ag-theme-quartz"
  style="height: 500px; width: 100%;"
  ...
/>
```

Import the theme CSS in `styles.scss`:

```scss
@use 'ag-grid-community/styles' as ag;
@include ag.grid-styles((theme: quartz));
```

Or import in `angular.json` styles array:

```json
"styles": ["ag-grid-community/styles/ag-theme-quartz.css"]
```

---

## CSS Variables (Theme Customisation)

All AG Grid themes expose CSS variables. Override in your component or global styles:

```css
.ag-theme-quartz {
  --ag-foreground-color: #333;
  --ag-background-color: #fff;
  --ag-header-background-color: #f5f5f5;
  --ag-row-hover-color: #e8f4fd;
  --ag-selected-row-background-color: #d0e8ff;
  --ag-font-size: 14px;
  --ag-grid-size: 6px; /* Controls row height, padding proportionally */
}
```

---

## `provideGlobalGridOptions` (App-Wide Defaults)

Set defaults for all grids in the application. Call once in `main.ts`:

```typescript
import { provideGlobalGridOptions } from 'ag-grid-community';

provideGlobalGridOptions({
  theme: 'legacy', // or use CSS class approach
  defaultColDef: {
    sortable: true,
    filter: true,
    resizable: true,
  },
  rowSelection: { mode: 'multiRow' },
});
```

---

## `domLayout`

Controls how the grid sizes itself:

| Value | Description | Limitation |
|---|---|---|
| `'normal'` | Fixed height — grid scrolls internally (default) | Requires explicit CSS height |
| `'autoHeight'` | Grid expands to fit all rows | **Do not use for >1 000 rows** |
| `'print'` | All rows rendered, no scrollbars | For printing/PDF only |

```html
<!-- normal: explicit height required -->
<ag-grid-angular
  class="ag-theme-quartz"
  style="height: 400px;"
  ...
/>

<!-- autoHeight: NO explicit height needed, grid grows with data -->
<ag-grid-angular
  class="ag-theme-quartz"
  [gridOptions]="{ domLayout: 'autoHeight' }"
  ...
/>
```

---

## Row Height

```typescript
gridOptions: GridOptions = {
  rowHeight: 48,          // fixed row height in pixels
  headerHeight: 56,       // header row height
  groupHeaderHeight: 40,  // group header height
};
```

Dynamic row height (use sparingly — impacts performance):

```typescript
gridOptions: GridOptions = {
  getRowHeight: (params: RowHeightParams) => {
    return params.data?.expanded ? 120 : 48;
  },
};
```

After changing row heights dynamically, call `api.resetRowHeights()`.

---

## Responsive Grid

Use Angular host binding or CSS container queries to make the grid fill its container:

```typescript
@Component({
  host: { class: 'ag-theme-quartz', style: 'display: block; height: 100%;' },
  template: `<ag-grid-angular style="height: 100%;" ... />`,
})
export class GridComponent {}
```
