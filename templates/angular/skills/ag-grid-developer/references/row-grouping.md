# AG Grid — Row Grouping (Enterprise)

Requires: `RowGroupingModule`

## Enabling Row Grouping

Set `rowGroup: true` on one or more columns:

```typescript
import { Component } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, GridOptions } from 'ag-grid-community';

@Component({
  standalone: true,
  imports: [AgGridAngular],
  template: `
    <ag-grid-angular
      [columnDefs]="columnDefs"
      [gridOptions]="gridOptions"
    />
  `,
})
export class GroupedGridComponent {
  columnDefs: ColDef[] = [
    { field: 'country', rowGroup: true, hide: true },
    { field: 'year', rowGroup: true, hide: true },
    { field: 'athlete' },
    { field: 'gold', aggFunc: 'sum' },
    { field: 'silver', aggFunc: 'sum' },
    { field: 'bronze', aggFunc: 'sum' },
  ];

  gridOptions: GridOptions = {
    groupDisplayType: 'singleColumn', // default
    groupDefaultExpanded: 1,
  };
}
```

> `hide: true` hides the grouped column from normal display (it is shown in the group column instead).

---

## Aggregation Functions

Built-in `aggFunc` values: `'sum'` | `'min'` | `'max'` | `'count'` | `'avg'` | `'first'` | `'last'`

Custom aggregation function:

```typescript
gridOptions: GridOptions = {
  aggFuncs: {
    weightedAvg: (params: IAggFuncParams) => {
      const sum = params.values.reduce((a, b) => a + b, 0);
      return sum / params.values.length;
    },
  },
};

const colDef: ColDef = { field: 'score', aggFunc: 'weightedAvg' };
```

---

## Group Display Types

| Value | Description |
|---|---|
| `'singleColumn'` | One auto-generated group column (default) |
| `'multipleColumns'` | One group column per grouped field |
| `'groupRows'` | Group rows replace the group column |
| `'custom'` | Developer provides group columns manually |

```typescript
gridOptions: GridOptions = {
  groupDisplayType: 'multipleColumns',
};
```

---

## `autoGroupColumnDef`

Customise the auto-generated group column:

```typescript
gridOptions: GridOptions = {
  autoGroupColumnDef: {
    headerName: 'Group',
    minWidth: 200,
    cellRendererParams: {
      suppressCount: false,
      checkbox: true,
    },
  },
};
```

---

## Row Group Panel (drag & drop)

Allows users to drag columns into a group panel to group interactively:

```typescript
gridOptions: GridOptions = {
  rowGroupPanelShow: 'always', // 'always' | 'onlyWhenGrouping' | 'never'
};
```

Requires `RowGroupingPanelModule`.

---

## Expanding Groups by Default

```typescript
gridOptions: GridOptions = {
  groupDefaultExpanded: -1, // -1 = expand all levels
};
```

---

## Programmatic Group Control

```typescript
// Expand all groups
api.expandAll();

// Collapse all groups
api.collapseAll();

// Expand/collapse a specific node
api.getRowNode('group-key')?.setExpanded(true);
```
