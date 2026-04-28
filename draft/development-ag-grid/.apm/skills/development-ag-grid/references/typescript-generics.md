# AG Grid — TypeScript Generics

AG Grid is fully generic over the row data type `TData`. Using generics gives compile-time type
safety for `ColDef`, `GridOptions`, grid events, and API callbacks.

## `GridOptions<TData>`

```typescript
import type { GridOptions } from 'ag-grid-community';

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
}

const gridOptions: GridOptions<Product> = {
  rowData: [],
  columnDefs: [
    { field: 'name' },         // 'name' is checked against Product fields
    { field: 'price' },
    { field: 'category' },
  ],
  defaultColDef: { flex: 1 },
};
```

---

## `ColDef<TData>` and `ColGroupDef<TData>`

```typescript
import type { ColDef, ColGroupDef } from 'ag-grid-community';

const columnDefs: (ColDef<Product> | ColGroupDef<Product>)[] = [
  {
    headerName: 'Product Info',
    children: [
      { field: 'name' },
      { field: 'category' },
    ],
  },
  {
    field: 'price',
    valueGetter: (p) => p.data?.price ?? 0,    // p.data is typed as Product | undefined
    valueFormatter: (p) => `$${p.value.toFixed(2)}`,
  },
];
```

---

## Typed Events & Callbacks

```typescript
import type {
  CellValueChangedEvent,
  GridReadyEvent,
  RowSelectedEvent,
  GetRowIdParams,
} from 'ag-grid-community';

@Component({ ... })
export class Grid {
  onGridReady(event: GridReadyEvent<Product>): void {
    this.#api = event.api;
  }

  onCellValueChanged(event: CellValueChangedEvent<Product>): void {
    const updated: Product = event.data; // typed as Product
    this.#service.save(updated);
  }

  onRowSelected(event: RowSelectedEvent<Product>): void {
    const row: Product | undefined = event.data;
  }

  // Typed getRowId — required for stable row identity
  getRowId = (params: GetRowIdParams<Product>) => String(params.data.id);
}
```

---

## `AgGridAngular` Component with Generic Type

When using `@ViewChild`, access the typed API:

```typescript
@ViewChild('grid') grid!: AgGridAngular<Product>;

doExport(): void {
  this.grid.api.exportDataAsExcel();
  const selected: Product[] = this.grid.api.getSelectedRows();
}
```

---

## `getRowId` (Row Identity)

Define a stable row ID to enable efficient updates, selection persistence, and SSRM row refresh:

```typescript
gridOptions: GridOptions<Product> = {
  getRowId: (params: GetRowIdParams<Product>) => String(params.data.id),
};
```

Required for `applyTransaction`, SSRM row refresh, and persistent selection across data updates.

---

## Typed `cellRendererParams`

When passing custom params to cell renderers, extend `ICellRendererParams`:

```typescript
interface PriceCellParams extends ICellRendererParams<Product> {
  currency: string;
  decimals: number;
}

const colDef: ColDef<Product> = {
  field: 'price',
  cellRenderer: PriceCellRenderer,
  cellRendererParams: {
    currency: 'EUR',
    decimals: 2,
  } satisfies Partial<PriceCellParams>,
};
```
