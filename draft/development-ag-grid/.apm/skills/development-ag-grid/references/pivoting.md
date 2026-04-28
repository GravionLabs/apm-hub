# AG Grid — Pivoting (Enterprise)

Requires: `PivotModule`, `RowGroupingModule`

## Enabling Pivoting

Pivoting requires:
1. `pivotMode: true` in grid options
2. At least one column with `rowGroup: true` (rows to group by)
3. At least one column with `aggFunc` (values to aggregate)
4. At least one column with `pivot: true` (column labels)

```typescript
import { Component } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, GridOptions } from 'ag-grid-community';

@Component({
  imports: [AgGridAngular],
  template: `
    <ag-grid-angular
      [columnDefs]="columnDefs"
      [pivotMode]="true"
      [sideBar]="'columns'"
    />
  `,
})
export class PivotGrid {
  columnDefs: ColDef[] = [
    { field: 'country', rowGroup: true, hide: true },
    { field: 'sport', pivot: true, enablePivot: true },
    { field: 'gold', aggFunc: 'sum' },
    { field: 'silver', aggFunc: 'sum' },
  ];
}
```

> `pivot: true` uses the column as a label dimension.
> `enablePivot: true` allows users to enable pivoting on this column via the UI.

---

## Pivot Mode vs Pivot Active

| State | `pivotMode` | Column has `pivot: true` | Behaviour |
|---|---|---|---|
| Normal | false | — | Full data display |
| Pivot mode, no pivot | true | false | Strips non-group/value columns, no pivot labels |
| Pivot active | true | true | Generates pivot result columns |

---

## Side Bar Integration

The Side Bar is the recommended UI for interactive pivot control:

```typescript
gridOptions: GridOptions = {
  pivotMode: true,
  sideBar: 'columns', // 'columns' | 'filters' | full SideBarDef
};
```

Requires `ColumnsToolPanelModule`.

Users can drag columns to the "Row Groups", "Values", and "Labels" sections to configure grouping,
aggregation, and pivoting without code changes.

---

## Pivot Panel

An alternative drag-and-drop UI above the grid:

```typescript
gridOptions: GridOptions = {
  pivotMode: true,
  pivotPanelShow: 'onlyWhenPivoting', // 'always' | 'onlyWhenPivoting' | 'never'
};
```

---

## Accessing Pivot Result Columns

Pivot result columns are generated dynamically. Access them via the column API:

```typescript
onGridReady(event: GridReadyEvent): void {
  const pivotCols = event.api.getPivotResultColumns();
  console.log('Pivot result columns:', pivotCols?.map(c => c.getColId()));
}
```

---

## Programmatic Pivot Toggle

```typescript
// Enable pivot mode at runtime
api.setGridOption('pivotMode', true);

// Add a pivot column programmatically
api.applyColumnState({
  state: [{ colId: 'sport', pivot: true }],
});
```

---

## Pivot with SSRM

When using the Server-Side Row Model, the server receives `pivotCols` in `params.request`.
The server is responsible for computing aggregations and returning pivot result columns.

```typescript
getRows(params: IServerSideGetRowsParams): void {
  const { pivotCols, pivotMode, rowGroupCols, valueCols } = params.request;
  // Pass to server to compute pivot result
}
```
