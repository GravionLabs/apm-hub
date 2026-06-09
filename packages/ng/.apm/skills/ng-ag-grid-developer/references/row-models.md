# AG Grid — Row Models

## Decision Tree

```
How many rows?
├─ < 100 000 rows (all in memory) → Client-Side Row Model (default)
└─ > 100 000 rows / server-side data → Server-Side Row Model (Enterprise)
      └─ Need scrolling without full load? → still SSRM with lazy loading
         (Infinite Row Model is deprecated for Enterprise — prefer SSRM)
```

---

## Client-Side Row Model (default)

- All row data loaded into the browser at once
- Supports: sorting, filtering, grouping, pivoting, tree data, full CRUD
- Register: `ClientSideRowModelModule`

```typescript
rowData: Product[] = [...]; // provide directly

gridOptions: GridOptions<Product> = {
  rowModelType: 'clientSide', // default — can be omitted
};
```

Refresh row data:

```typescript
api.setGridOption('rowData', newRowData);        // replace all
api.applyTransaction({ add: [], update: [], remove: [] }); // partial update
```

---

## Server-Side Row Model (Enterprise)

- Data fetched from the server on demand (lazy loading)
- Required for: SSRM grouping, server-side pivoting, millions of rows
- Register: `ServerSideRowModelModule`

### Minimal Datasource

```typescript
import type { IServerSideDatasource, IServerSideGetRowsParams } from 'ag-grid-community';

class MyDatasource implements IServerSideDatasource {
  getRows(params: IServerSideGetRowsParams): void {
    const { startRow, endRow, sortModel, filterModel } = params.request;

    myApiService.getRows({ startRow, endRow, sortModel, filterModel })
      .subscribe({
        next: result => params.success({ rowData: result.rows, rowCount: result.total }),
        error: () => params.fail(),
      });
  }
}
```

### Registering the Datasource

```typescript
gridOptions: GridOptions = {
  rowModelType: 'serverSide', // [Initial] — cannot change after creation
  serverSideInitialRowCount: 100,
};

// After gridReady:
api.setGridOption('serverSideDatasource', new MyDatasource());
```

> `rowModelType` is an **Initial** option — the grid must be destroyed and re-created to change it.

### SSRM with Server-Side Grouping

```typescript
gridOptions: GridOptions = {
  rowModelType: 'serverSide',
  serverSideEnableClientSideSort: false, // let server handle sort
};

columnDefs: ColDef[] = [
  { field: 'country', rowGroup: true, hide: true },
  { field: 'sales', aggFunc: 'sum' },
];
```

The datasource `getRows` receives `rowGroupCols`, `groupKeys`, and `pivotCols` in `params.request`
so the server can apply grouping and pivoting.

---

## Infinite Row Model (Legacy)

Deprecated for new Enterprise projects. Use SSRM instead — it provides a superset of Infinite's
capabilities including server-side grouping, pivoting, and better row refresh support.

---

## Viewport Row Model (Enterprise)

For real-time data grids displaying only the visible rows (e.g., trading screens).
Register: `ViewportRowModelModule`. Requires implementing `IViewportDatasource`.
