# AG Grid — Excel Export (Enterprise)

Requires: `ExcelExportModule`

## Basic Export

```typescript
// Trigger from a button or toolbar
api.exportDataAsExcel();
```

The default export mirrors the current grid state: applied sorts, filters, row grouping, and
visible columns are all reflected in the output.

---

## Export with Options

```typescript
import type { ExcelExportParams } from 'ag-grid-community';

const exportParams: ExcelExportParams = {
  fileName: 'my-report.xlsx',
  sheetName: 'Data',
  columnKeys: ['name', 'price', 'category'], // only these columns
  onlySelected: false,
  skipPinnedTop: false,
  skipPinnedBottom: false,
};

api.exportDataAsExcel(exportParams);
```

---

## Filtering Exported Rows

```typescript
api.exportDataAsExcel({
  onlySelectedAllPages: false,
  // Export only rows matching a custom predicate
  shouldRowBeSkipped: (params) => params.node.data?.status === 'archived',
});
```

---

## Custom Column Width

```typescript
api.exportDataAsExcel({
  columnWidth: (params) => {
    if (params.column?.getId() === 'name') return 200;
    return 100; // default width in pixels
  },
});
```

---

## Custom Cell Styles

Define styles via `ExcelStyle` and reference them by CSS class name in `ColDef.cellClass`:

```typescript
import type { ExcelStyle } from 'ag-grid-community';

const excelStyles: ExcelStyle[] = [
  {
    id: 'highlight',
    interior: { color: '#FFFF00', pattern: 'Solid' },
    font: { bold: true },
  },
];

gridOptions: GridOptions = { excelStyles };

const colDef: ColDef = {
  field: 'price',
  cellClass: 'highlight', // applied in Excel export
};
```

---

## Multiple Sheets

```typescript
import { getMultipleSheetsAsExcel } from 'ag-grid-community';

const sheet1 = api.getSheetDataForExcel({ sheetName: 'Summary' });
const sheet2 = otherApi.getSheetDataForExcel({ sheetName: 'Detail' });

if (sheet1 && sheet2) {
  const data = getMultipleSheetsAsExcel({ data: [sheet1, sheet2] });
  // Trigger browser download
  const blob = new Blob([data!], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'multi-sheet.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}
```

---

## Extra Content (Headers / Footers)

```typescript
api.exportDataAsExcel({
  prependContent: [
    [
      { data: { value: 'Report Title', type: 'String' }, mergeAcross: 3 },
    ],
    [
      { data: { value: `Exported: ${new Date().toLocaleDateString()}`, type: 'String' } },
    ],
  ],
  appendContent: [
    [{ data: { value: 'End of Report', type: 'String' } }],
  ],
});
```

---

## Export Notes

- Cell renderer values are **not** exported — raw data values (or `valueFormatter` output) are used
- Use `valueFormatter` to ensure formatted values appear in the export
- Cell styles are not exported by default — use `excelStyles` with `cellClass` to add them
