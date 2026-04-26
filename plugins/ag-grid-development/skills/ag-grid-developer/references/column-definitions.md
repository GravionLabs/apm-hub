# AG Grid — Column Definitions

## Basic ColDef

```typescript
import type { ColDef } from 'ag-grid-community';

interface Product {
  name: string;
  price: number;
  category: string;
}

const columnDefs: ColDef<Product>[] = [
  { field: 'name', headerName: 'Product Name', sortable: true, filter: true },
  { field: 'price', filter: 'agNumberColumnFilter', valueFormatter: p => `$${p.value}` },
  { field: 'category', filter: 'agSetColumnFilter' }, // Enterprise: Set Filter
];
```

## defaultColDef

Applied to every column unless overridden in the individual `ColDef`:

```typescript
import type { ColDef } from 'ag-grid-community';

const defaultColDef: ColDef = {
  flex: 1,
  minWidth: 100,
  sortable: true,
  filter: true,
  resizable: true,
};
```

## Column Types (reusable presets)

```typescript
import type { ColDef, ColTypeDef } from 'ag-grid-community';

const columnTypes: Record<string, ColTypeDef> = {
  currency: {
    filter: 'agNumberColumnFilter',
    valueFormatter: p => p.value != null ? `€${p.value.toFixed(2)}` : '',
    cellClass: 'ag-right-aligned-cell',
  },
  dateColumn: {
    filter: 'agDateColumnFilter',
    valueFormatter: p => p.value ? new Date(p.value).toLocaleDateString() : '',
  },
};

const columnDefs: ColDef[] = [
  { field: 'price', type: 'currency' },
  { field: 'createdAt', type: 'dateColumn' },
];
```

## Value Getter / Setter / Formatter / Parser

```typescript
const colDef: ColDef = {
  headerName: 'Full Name',
  // Computed value — not stored in data
  valueGetter: p => `${p.data.firstName} ${p.data.lastName}`,

  // Format for display only
  valueFormatter: p => p.value?.toUpperCase() ?? '',

  // Parse user input back to a typed value
  valueParser: p => Number(p.newValue),

  // Write edited value back to data (needed when valueGetter is used)
  valueSetter: p => {
    const [first, last] = p.newValue.split(' ');
    p.data.firstName = first;
    p.data.lastName = last;
    return true;
  },
};
```

## Cell Data Types

AG Grid infers cell data types automatically. Override with `cellDataType`:

```typescript
const colDef: ColDef = {
  field: 'isActive',
  cellDataType: 'boolean', // renders as checkbox
};
```

Valid values: `'text'` | `'number'` | `'boolean'` | `'date'` | `'dateString'` | `'object'`

## Pinned Columns

```typescript
const columnDefs: ColDef[] = [
  { field: 'id', pinned: 'left', width: 80 },
  { field: 'actions', pinned: 'right', width: 120 },
];
```

## Updating Column Definitions

```typescript
// Replace all column defs
api.setGridOption('columnDefs', newColDefs);

// Update specific columns by colId
api.updateGridOptions({ columnDefs: updatedColDefs });

// Apply column state (visibility, width, sort, pinning)
api.applyColumnState({
  state: [{ colId: 'price', sort: 'desc', hide: false }],
  applyOrder: true,
});
```

## Column Groups

```typescript
import type { ColGroupDef } from 'ag-grid-community';

const columnDefs: (ColDef | ColGroupDef)[] = [
  {
    headerName: 'Personal Info',
    children: [
      { field: 'firstName' },
      { field: 'lastName' },
    ],
  },
  { field: 'salary' },
];
```
