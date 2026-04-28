# AG Grid — Master / Detail (Enterprise)

Requires: `MasterDetailModule`

Master / Detail displays a child grid (detail) when a row in the parent grid (master) is expanded.

## Enabling Master / Detail

```typescript
import { Component } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, GridOptions, IDetailCellRendererParams } from 'ag-grid-community';

interface Account {
  name: string;
  accountId: string;
  callRecords: CallRecord[];
}

interface CallRecord {
  callId: number;
  direction: string;
  duration: number;
}

@Component({
  imports: [AgGridAngular],
  template: `
    <ag-grid-angular
      [masterDetail]="true"
      [columnDefs]="columnDefs"
      [detailCellRendererParams]="detailCellRendererParams"
      [gridOptions]="gridOptions"
    />
  `,
})
export class MasterDetail {
  columnDefs: ColDef<Account>[] = [
    { field: 'name', cellRenderer: 'agGroupCellRenderer' },
    { field: 'accountId' },
  ];

  detailCellRendererParams: IDetailCellRendererParams<Account, CallRecord> = {
    detailGridOptions: {
      columnDefs: [
        { field: 'callId' },
        { field: 'direction' },
        { field: 'duration', valueFormatter: p => `${p.value}s` },
      ],
      defaultColDef: { flex: 1 },
    },
    getDetailRowData: params => {
      params.successCallback(params.data.callRecords);
    },
  };

  gridOptions: GridOptions = {
    detailRowHeight: 300,
  };
}
```

---

## Dynamic Master Rows

Control which rows can expand using `isRowMaster`:

```typescript
gridOptions: GridOptions = {
  masterDetail: true,
  isRowMaster: (data: Account) => data.callRecords?.length > 0,
};
```

---

## Detail Row Height

```typescript
// Fixed height
gridOptions: GridOptions = { detailRowHeight: 250 };

// Auto height (adjusts to detail grid content — [Initial] option)
gridOptions: GridOptions = { detailRowAutoHeight: true };
```

> `detailRowAutoHeight` is an **Initial** option — cannot be changed after grid creation.

---

## Keeping Detail Rows Alive

By default, detail grids are destroyed when collapsed. To keep them in memory:

```typescript
gridOptions: GridOptions = {
  keepDetailRows: true,
  keepDetailRowsCount: 5, // max number of detail grids kept in memory
};
```

---

## Custom Angular Detail Component

Replace the default detail grid with any Angular component:

```typescript
import type { IDetailCellRenderer, IDetailCellRendererParams } from 'ag-grid-community';

@Component({
  selector: 'app-custom-detail',
  template: `<div>Custom detail for: {{ data?.name }}</div>`,
})
export class CustomDetail implements IDetailCellRenderer {
  protected data: Account | null = null;

  agInit(params: IDetailCellRendererParams<Account>): void {
    this.data = params.data;
  }

  refresh(): boolean {
    return false; // returning false recreates the component on refresh
  }
}
```

Register in grid options:

```typescript
gridOptions: GridOptions = {
  masterDetail: true,
  detailCellRenderer: CustomDetailComponent,
};
```

---

## Detail Grid API

Access the detail grid API to interact with it programmatically:

```typescript
const masterNode = api.getRowNode('master-row-id');
const detailApi = masterNode?.detailNode?.detailGridInfo?.api;
detailApi?.exportDataAsExcel();
```

---

## Row Models

The **master** grid must use Client-Side or Server-Side Row Model.
The **detail** grid can use any row model (including its own SSRM datasource).
