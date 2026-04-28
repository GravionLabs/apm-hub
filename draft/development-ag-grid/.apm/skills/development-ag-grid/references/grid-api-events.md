# AG Grid — Grid API & Events

## Accessing the Grid API

### Via `gridReady` Event (Recommended)

```typescript
import { Component } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import type { GridApi, GridReadyEvent } from 'ag-grid-community';

@Component({
  imports: [AgGridAngular],
  template: `<ag-grid-angular (gridReady)="onGridReady($event)" ... />`,
})
export class Grid {
  #api!: GridApi;

  onGridReady(event: GridReadyEvent): void {
    this.#api = event.api;
  }
}
```

### Via `@ViewChild`

```typescript
import { Component, ViewChild } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';

@Component({
  imports: [AgGridAngular],
  template: `<ag-grid-angular #myGrid ... />`,
})
export class Grid {
  @ViewChild('myGrid') grid!: AgGridAngular;

  doSomething(): void {
    this.grid.api.exportDataAsExcel();
  }
}
```

> Prefer the `gridReady` approach for more reliable API access in lifecycle hooks.

---

## Updating Grid Options at Runtime

```typescript
// Update a single option
api.setGridOption('rowData', newData);
api.setGridOption('columnDefs', newColDefs);

// Update multiple options atomically
api.updateGridOptions({
  rowData: newData,
  defaultColDef: { flex: 2 },
});
```

> Options marked `[Initial]` in the docs cannot be updated — the grid must be recreated.

---

## Common Grid Events

Bind events directly on `<ag-grid-angular>`:

```typescript
@Component({
  template: `
    <ag-grid-angular
      (cellValueChanged)="onCellValueChanged($event)"
      (selectionChanged)="onSelectionChanged($event)"
      (rowDataUpdated)="onRowDataUpdated($event)"
      (sortChanged)="onSortChanged($event)"
      (filterChanged)="onFilterChanged($event)"
      (firstDataRendered)="onFirstDataRendered($event)"
    />
  `,
})
export class Grid {
  onCellValueChanged(event: CellValueChangedEvent): void {
    console.log('Cell changed:', event.colDef.field, event.oldValue, '→', event.newValue);
  }

  onSelectionChanged(event: SelectionChangedEvent): void {
    const selected = event.api.getSelectedRows();
    console.log('Selected rows:', selected);
  }
}
```

---

## Row & Cell Refresh

```typescript
// Refresh specific rows (re-renders cells, re-runs valueGetters)
api.refreshCells({ rowNodes: [node], force: true });

// Refresh all visible cells
api.refreshCells();

// Redraw rows (destroys and recreates DOM — use sparingly)
api.redrawRows({ rowNodes: [node] });
```

---

## Selection API

```typescript
// Get all selected rows
const selected = api.getSelectedRows();

// Get all selected nodes (for SSRM)
const nodes = api.getSelectedNodes();

// Clear selection
api.deselectAll();

// Select all
api.selectAll();
```

---

## Sorting & Filtering API

```typescript
// Apply a sort programmatically
api.applyColumnState({
  state: [{ colId: 'price', sort: 'desc' }],
  defaultState: { sort: null },
});

// Apply a filter model
api.setFilterModel({
  price: { filterType: 'number', type: 'greaterThan', filter: 1000 },
});

// Get current filter model
const filterModel = api.getFilterModel();

// Clear all filters
api.setFilterModel(null);
```

---

## Scrolling

```typescript
// Scroll to a row by index
api.ensureIndexVisible(50, 'middle');

// Scroll to a column
api.ensureColumnVisible('price');
```
