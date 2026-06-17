# AG Grid Enterprise — Setup

## Installation

```bash
npm install ag-grid-angular ag-grid-enterprise
```

Both packages must be the same version. Verify with:

```bash
npm ls ag-grid-angular ag-grid-enterprise
```

## License Configuration

Call `LicenseManager.setLicenseKey()` **before** `ModuleRegistry.registerModules()`.
Place this in `main.ts` (or `app.config.ts` for standalone apps).

```typescript
// main.ts
import { ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule, LicenseManager } from 'ag-grid-enterprise';

LicenseManager.setLicenseKey('YOUR_LICENSE_KEY');
ModuleRegistry.registerModules([AllEnterpriseModule]);
```

> Without a license key, AG Grid Enterprise still works locally but displays a watermark and
> a console warning. For production, always set the key.

## Minimal Angular Component

```typescript
import { Component } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, GridOptions } from 'ag-grid-community';

interface Car {
  make: string;
  model: string;
  price: number;
}

@Component({
  selector: 'app-grid',
  standalone: true,
  imports: [AgGridAngular],
  template: `
    <ag-grid-angular
      class="ag-theme-alpine"
      style="height: 500px;"
      [rowData]="rowData"
      [columnDefs]="columnDefs"
      [gridOptions]="gridOptions"
    />
  `,
})
export class GridComponent {
  rowData: Car[] = [
    { make: 'Toyota', model: 'Corolla', price: 29_600 },
    { make: 'Ford', model: 'F-Series', price: 33_850 },
  ];

  columnDefs: ColDef<Car>[] = [
    { field: 'make' },
    { field: 'model' },
    { field: 'price', filter: 'agNumberColumnFilter' },
  ];

  gridOptions: GridOptions<Car> = {
    defaultColDef: { flex: 1, sortable: true, filter: true },
  };
}
```

## Providing Modules to Individual Grids

When multiple grids in the app have different feature sets, pass modules directly:

```typescript
import { Component } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { ClientSideRowModelModule, Module } from 'ag-grid-community';
import { ExcelExportModule, RowGroupingModule } from 'ag-grid-enterprise';

@Component({
  standalone: true,
  imports: [AgGridAngular],
  template: `<ag-grid-angular [modules]="modules" ... />`,
})
export class MyGridComponent {
  modules: Module[] = [
    ClientSideRowModelModule,
    RowGroupingModule,
    ExcelExportModule,
  ];
}
```

## Integrated Charts (Enterprise Bundle)

If the license includes AG Charts Enterprise, enable integrated charts:

```typescript
import { AgChartsEnterpriseModule } from 'ag-charts-enterprise';
import { ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';

LicenseManager.setLicenseKey('YOUR_LICENSE_KEY');
ModuleRegistry.registerModules([
  AllEnterpriseModule.with(AgChartsEnterpriseModule),
]);
```
