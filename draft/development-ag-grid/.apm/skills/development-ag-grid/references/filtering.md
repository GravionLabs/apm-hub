# AG Grid — Filtering

## Column Filters

Set via `ColDef.filter`:

| Filter | Value | Requires |
|---|---|---|
| Text | `'agTextColumnFilter'` | Community |
| Number | `'agNumberColumnFilter'` | Community |
| Date | `'agDateColumnFilter'` | Community |
| Set Filter | `'agSetColumnFilter'` | Enterprise |
| Multi Filter | `'agMultiColumnFilter'` | Enterprise |

```typescript
const columnDefs: ColDef[] = [
  { field: 'name', filter: 'agTextColumnFilter' },
  { field: 'price', filter: 'agNumberColumnFilter' },
  { field: 'category', filter: 'agSetColumnFilter' }, // Enterprise
];
```

### Filter Parameters

```typescript
const colDef: ColDef = {
  field: 'price',
  filter: 'agNumberColumnFilter',
  filterParams: {
    filterOptions: ['greaterThan', 'lessThan', 'inRange'],
    defaultOption: 'greaterThan',
  },
};
```

---

## Quick Filter (Search Box)

Bind the search input to `api.setGridOption('quickFilterText', value)`:

```typescript
@Component({
  template: `
    <input (input)="onSearch($event)" placeholder="Search..." />
    <ag-grid-angular (gridReady)="onGridReady($event)" ... />
  `,
})
export class Grid {
  #api!: GridApi;

  onGridReady(e: GridReadyEvent): void {
    this.#api = e.api;
  }

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.#api.setGridOption('quickFilterText', value);
  }
}
```

---

## External Filter

Use when filtering logic is maintained outside the grid (e.g., a filter panel):

```typescript
gridOptions: GridOptions = {
  isExternalFilterPresent: () => this.activeCategory !== 'All',
  doesExternalFilterPass: (node) => node.data.category === this.activeCategory,
};

// After changing filter state:
this.activeCategory = 'Electronics';
this.#api.onFilterChanged();
```

---

## Advanced Filter (Enterprise)

Renders a filter expression builder above the grid. Requires `AdvancedFilterModule`.

```typescript
gridOptions: GridOptions = {
  enableAdvancedFilter: true,
};
```

Advanced Filter supports complex boolean expressions (`AND`/`OR`) built by the user via UI.
Programmatically get/set the filter model:

```typescript
// Set filter model
api.setAdvancedFilterModel({
  filterType: 'join',
  type: 'AND',
  conditions: [
    { filterType: 'text', colId: 'name', type: 'contains', filter: 'AG' },
    { filterType: 'number', colId: 'price', type: 'greaterThan', filter: 500 },
  ],
});

// Clear advanced filter
api.setAdvancedFilterModel(null);
```

---

## Programmatic Filter API

```typescript
// Set filter model (Column Filters)
api.setFilterModel({
  name: { filterType: 'text', type: 'contains', filter: 'AG' },
  price: { filterType: 'number', type: 'inRange', filter: 100, filterTo: 500 },
});

// Get current filter model
const model = api.getFilterModel();

// Clear all column filters
api.setFilterModel(null);
```
