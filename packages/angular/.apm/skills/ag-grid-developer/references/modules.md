# AG Grid — Module Registration

## Bundles (Quick Start)

| Bundle | Contents |
|---|---|
| `AllCommunityModule` | All Community features |
| `AllEnterpriseModule` | `AllCommunityModule` + all Enterprise features |

```typescript
import { ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';

// In main.ts — before any grid is rendered
ModuleRegistry.registerModules([AllEnterpriseModule]);
```

> Using a bundle includes `ValidationModule` automatically, which logs helpful console warnings
> in all environments. For production bundle size, switch to cherry-picked modules.

## Cherry-Picking Modules

Import only the modules you need. Each module corresponds to a specific feature:

```typescript
import {
  ModuleRegistry,
  ClientSideRowModelModule,
  TextFilterModule,
  NumberFilterModule,
  CsvExportModule,
  ValidationModule,
} from 'ag-grid-community';
import {
  RowGroupingModule,
  ExcelExportModule,
  MasterDetailModule,
  SetFilterModule,
  ColumnsToolPanelModule,
  FiltersToolPanelModule,
} from 'ag-grid-enterprise';

if (process.env['NODE_ENV'] !== 'production') {
  ModuleRegistry.registerModules([ValidationModule]);
}

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  TextFilterModule,
  NumberFilterModule,
  CsvExportModule,
  RowGroupingModule,
  ExcelExportModule,
  MasterDetailModule,
  SetFilterModule,
  ColumnsToolPanelModule,
  FiltersToolPanelModule,
]);
```

## Common Enterprise Modules

| Module | Feature |
|---|---|
| `RowGroupingModule` | Row grouping & aggregation |
| `PivotModule` | Pivoting |
| `ExcelExportModule` | Excel export |
| `MasterDetailModule` | Master/Detail grids |
| `SetFilterModule` | Set Filter (checkbox list) |
| `MultiFilterModule` | Multi Filter |
| `AdvancedFilterModule` | Advanced Filter bar |
| `ColumnsToolPanelModule` | Columns side panel |
| `FiltersToolPanelModule` | Filters side panel |
| `ServerSideRowModelModule` | Server-Side Row Model |
| `ClipboardModule` | Copy/paste |
| `RangeSelectionModule` | Range selection |
| `StatusBarModule` | Status bar (row count etc.) |

## ValidationModule (Development Only)

```typescript
import { ValidationModule } from 'ag-grid-community';

if (process.env['NODE_ENV'] !== 'production') {
  ModuleRegistry.registerModules([ValidationModule]);
}
```

## Check if Module is Registered

```typescript
const isRegistered = api.isModuleRegistered('SetFilterModule');
```

## Angular CLI Bundle Size Notes

The Angular CLI supports multiple builders (`esbuild`, `webpack`). When optimising bundle size,
compare outputs from each builder — results vary by application. Use `source-map-explorer` to
identify which AG Grid modules contribute most to bundle size.
