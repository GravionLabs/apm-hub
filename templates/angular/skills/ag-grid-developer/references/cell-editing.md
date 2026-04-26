# AG Grid — Cell Editing (Angular)

## Enabling Editing

```typescript
// All cells in a column editable
const colDef: ColDef = { field: 'name', editable: true };

// Conditional editing (callback)
const colDef: ColDef = {
  field: 'price',
  editable: (params: EditableCallbackParams) => params.data.status === 'draft',
};
```

---

## Provided Cell Editors

| Editor | ColDef value | Notes |
|---|---|---|
| Text | `'agTextCellEditor'` | Default |
| Large Text | `'agLargeTextCellEditor'` | Textarea popup |
| Select | `'agSelectCellEditor'` | Dropdown |
| Rich Select | `'agRichSelectCellEditor'` | Enterprise, with search |
| Number | `'agNumberCellEditor'` | Validates numeric input |
| Date | `'agDateCellEditor'` | Date picker |
| Checkbox | `'agCheckboxCellEditor'` | Boolean |

```typescript
const colDef: ColDef = {
  field: 'category',
  editable: true,
  cellEditor: 'agRichSelectCellEditor', // Enterprise
  cellEditorParams: {
    values: ['Electronics', 'Clothing', 'Food'],
    searchType: 'fuzzy',
  },
};
```

---

## Custom Angular Cell Editor

Implement `ICellEditorAngularComp`:

```typescript
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ICellEditorAngularComp } from 'ag-grid-angular';
import type { ICellEditorParams } from 'ag-grid-community';

@Component({
  selector: 'app-number-editor',
  standalone: true,
  imports: [FormsModule],
  template: `<input type="number" [(ngModel)]="value" (keydown)="onKeyDown($event)" />`,
})
export class NumberEditorComponent implements ICellEditorAngularComp {
  protected value!: number;

  agInit(params: ICellEditorParams): void {
    this.value = params.value;
  }

  // Called by grid to retrieve the final edited value
  getValue(): number {
    return this.value;
  }

  // Optional: return true if editing should pop up above the cell
  isPopup(): boolean {
    return false;
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      // grid will call getValue() and stop editing automatically
    }
  }
}
```

Register in the column definition:

```typescript
const colDef: ColDef = {
  field: 'quantity',
  editable: true,
  cellEditor: NumberEditorComponent,
};
```

---

## Dynamic Editor Selection (`cellEditorSelector`)

```typescript
const colDef: ColDef = {
  field: 'value',
  editable: true,
  cellEditorSelector: (params: CellEditorSelectorFuncParams) => {
    if (params.data.type === 'number') {
      return { component: NumberEditorComponent };
    }
    if (params.data.type === 'select') {
      return {
        component: 'agRichSelectCellEditor',
        params: { values: params.data.options },
      };
    }
    return { component: 'agTextCellEditor' };
  },
};
```

---

## Editing Events

```typescript
@Component({
  template: `
    <ag-grid-angular
      (cellValueChanged)="onCellValueChanged($event)"
      (cellEditingStarted)="onEditingStarted($event)"
      (cellEditingStopped)="onEditingStopped($event)"
    />
  `,
})
export class GridComponent {
  onCellValueChanged(event: CellValueChangedEvent): void {
    // Persist changes
    this.#dataService.update(event.data);
  }

  onEditingStarted(event: CellEditingStartedEvent): void {
    console.log('Editing started:', event.colDef.field);
  }

  onEditingStopped(event: CellEditingStoppedEvent): void {
    if (!event.valueChanged) return;
    // value was changed and editing stopped
  }
}
```

---

## Programmatic Editing Control

```typescript
// Start editing a specific cell
api.startEditingCell({ rowIndex: 0, colKey: 'name' });

// Stop editing (commit)
api.stopEditing(false);

// Stop editing (cancel)
api.stopEditing(true);
```
