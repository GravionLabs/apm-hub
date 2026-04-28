# AG Grid — Cell Rendering (Angular)

## Function Renderer (Simple Cases)

Use for stateless, non-interactive rendering without refresh logic:

```typescript
const columnDefs: ColDef[] = [
  {
    field: 'status',
    cellRenderer: (params: ICellRendererParams) =>
      params.value === 'active'
        ? '<span class="badge badge-green">Active</span>'
        : '<span class="badge badge-red">Inactive</span>',
  },
];
```

---

## Angular Component Renderer

Implement `ICellRendererAngularComp` for stateful or interactive renderers:

```typescript
import { Component } from '@angular/core';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';

@Component({
  selector: 'app-status-cell',
  template: `
    <span [class]="badgeClass">{{ label }}</span>
    <button (click)="onClick()">Edit</button>
  `,
})
export class StatusCellRenderer implements ICellRendererAngularComp {
  protected label = '';
  protected badgeClass = '';
  #params!: ICellRendererParams;

  agInit(params: ICellRendererParams): void {
    this.#params = params;
    this.#update(params);
  }

  // Return true if you handled the refresh yourself; false to let the grid recreate
  refresh(params: ICellRendererParams): boolean {
    this.#update(params);
    return true;
  }

  protected onClick(): void {
    this.#params.api.startEditingCell({
      rowIndex: this.#params.rowIndex,
      colKey: this.#params.column!.getId(),
    });
  }

  #update(params: ICellRendererParams): void {
    this.label = params.value;
    this.badgeClass = params.value === 'active' ? 'badge-green' : 'badge-red';
  }
}
```

Register in the column definition:

```typescript
const columnDefs: ColDef[] = [
  { field: 'status', cellRenderer: StatusCellRenderer },
];
```

---

## Dynamic Renderer Selection (`cellRendererSelector`)

Choose different renderers per row based on row data:

```typescript
const colDef: ColDef = {
  field: 'value',
  cellRendererSelector: (params: ICellRendererParams) => {
    if (params.data?.type === 'chart') {
      return { component: ChartCellRenderer };
    }
    if (params.data?.type === 'badge') {
      return { component: BadgeCellRenderer, params: { color: 'blue' } };
    }
    return undefined; // fallback to default cell rendering
  },
};
```

For grouped rows, skip the custom renderer on group nodes:

```typescript
cellRendererSelector: params => {
  return params.node.group
    ? undefined
    : { component: MyCellRenderer };
},
```

---

## Passing Custom Props (`cellRendererParams`)

```typescript
const colDef: ColDef = {
  field: 'price',
  cellRenderer: CurrencyCellRenderer,
  cellRendererParams: {
    currency: 'EUR',
    decimals: 2,
  },
};
```

In the renderer component, access via `params`:

```typescript
agInit(params: ICellRendererParams & { currency: string; decimals: number }): void {
  this.formatted = `${params.currency} ${params.value.toFixed(params.decimals)}`;
}
```

---

## Provided Cell Renderers

| Name | Purpose |
|---|---|
| `'agGroupCellRenderer'` | Expand/collapse for row groups and master/detail |
| `'agAnimateShowChangeCellRenderer'` | Animate value changes |
| `'agAnimateSlideCellRenderer'` | Slide animation on value change |
| `'agCheckboxCellRenderer'` | Checkbox for boolean `cellDataType` |
