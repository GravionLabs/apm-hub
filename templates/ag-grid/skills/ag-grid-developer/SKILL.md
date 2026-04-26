---
name: ag-grid-developer
description: >
  Use this skill when building or modifying Angular components that integrate AG Grid Enterprise.
  Covers Enterprise setup, module registration, column definitions, row models (including SSRM),
  filtering, cell rendering, cell editing, row grouping, pivoting, master/detail, Excel export,
  theming, and TypeScript generics. Triggers on tasks like "add ag-grid", "configure columns",
  "enable row grouping", "export to Excel", "set up SSRM", or "customize cell renderer".
allowed-tools: execute shell runCommands read write edit editFiles search codebase mcp_ag-mcp_search_docs mcp_ag-mcp_detect_version
license: MIT
---

## Basic Rules

If ag‑mcp is available → use search_docs; otherwise fall back to references/.

- AG Grid version: always verify with `npm ls ag-grid-angular ag-grid-enterprise` before making changes
- Enterprise is the standard — use `AllEnterpriseModule`, never `AllCommunityModule` on its own
- `LicenseManager.setLicenseKey()` must be called **before** `ModuleRegistry.registerModules()`
- Modules must be registered before any grid is instantiated
- `AgGridAngular` is a standalone Angular component — always add it to the `imports` array
- Prefer cherry-picked modules over `AllEnterpriseModule` in production to minimise bundle size

## Enterprise Setup

Read [enterprise-setup.md](references/enterprise-setup.md) when:
- Setting up AG Grid Enterprise for the first time
- Configuring the license key
- Deciding between `AllEnterpriseModule` and individual modules

## Modules

Read [modules.md](references/modules.md) when:
- Registering modules (globally or per grid)
- Cherry-picking individual modules to reduce bundle size
- Adding `ValidationModule` for development warnings
- Providing modules to individual grids via `[modules]` binding

## Column Definitions

Read [column-definitions.md](references/column-definitions.md) when:
- Defining `ColDef` or `defaultColDef`
- Using `columnTypes`, `valueGetter`, `valueFormatter`, or `valueParser`
- Configuring cell data types or pinned columns
- Dynamically adding, removing, or updating column definitions

## Row Data & Row Models

Read [row-models.md](references/row-models.md) when:
- Choosing between Client-Side Row Model (CSRM) and Server-Side Row Model (SSRM)
- Implementing an SSRM datasource
- Handling large datasets (>100k rows)
- Configuring lazy loading or server-side grouping/pivoting

## Grid API & Events

Read [grid-api-events.md](references/grid-api-events.md) when:
- Accessing the grid API via `@ViewChild` or the `gridReady` event
- Calling `api.setGridOption()` or `api.updateGridOptions()`
- Subscribing to grid events (e.g., `cellValueChanged`, `selectionChanged`, `rowDataUpdated`)
- Refreshing rows or cells programmatically

## Filtering

Read [filtering.md](references/filtering.md) when:
- Configuring column filters (`filter: 'agTextColumnFilter'` etc.)
- Adding a Quick Filter (search box)
- Using External Filter via `isExternalFilterPresent` / `doesExternalFilterPass`
- Enabling Advanced Filter (Enterprise)

## Cell Rendering

Read [cell-rendering.md](references/cell-rendering.md) when:
- Creating a custom Angular cell renderer component implementing `ICellRendererAngularComp`
- Using a function renderer for simple cases
- Using `cellRendererSelector` for dynamic renderer selection per row

## Cell Editing

Read [cell-editing.md](references/cell-editing.md) when:
- Enabling editing with `editable: true` (static or callback)
- Creating a custom Angular cell editor implementing `ICellEditorAngularComp`
- Handling `cellValueChanged` or `cellEditingStopped` events
- Using provided editors (`agTextCellEditor`, `agSelectCellEditor`, `agRichSelectCellEditor`)

## Row Grouping & Pivoting

Read [row-grouping.md](references/row-grouping.md) when:
- Enabling `rowGroup: true` on column definitions
- Configuring aggregation with `aggFunc`
- Customising group display type (`singleColumn`, `multipleColumns`, `groupRows`)
- Configuring `autoGroupColumnDef`

Read [pivoting.md](references/pivoting.md) when:
- Enabling `pivotMode: true`
- Setting `pivot: true` on a column
- Combining row grouping, aggregation, and pivoting
- Configuring the Side Bar for user-driven pivot control

## Master / Detail

Read [master-detail.md](references/master-detail.md) when:
- Enabling `masterDetail: true`
- Configuring `detailCellRendererParams` with `detailGridOptions` and `getDetailRowData`
- Using a custom Angular component as the detail cell renderer
- Determining which rows are master rows via `isRowMaster`

## Excel Export

Read [excel-export.md](references/excel-export.md) when:
- Calling `api.exportDataAsExcel()`
- Customising exported columns, rows, or styles
- Exporting to multiple sheets
- Adding extra content (headers, footers, images)

## Theming & Layout

Read [theming.md](references/theming.md) when:
- Selecting or customising a built-in theme (`agThemeAlpine`, `agThemeBalham`, `agThemeQuartz`)
- Using `provideGlobalGridOptions` for app-wide defaults
- Setting `domLayout` (`normal`, `autoHeight`, `print`)
- Customising theme colours via CSS variables

## TypeScript Generics

Read [typescript-generics.md](references/typescript-generics.md) when:
- Typing `GridOptions<TData>`, `ColDef<TData>`, or `ColGroupDef<TData>`
- Working with typed grid events and callbacks
- Inferring row data type through generic constraints

## Gotchas

- **`LicenseManager` before `ModuleRegistry`**: Always call `LicenseManager.setLicenseKey()` before `ModuleRegistry.registerModules()` — otherwise enterprise features may not activate correctly
- **Modules before grid instantiation**: Register modules globally (in `main.ts` or `app.config.ts`) before any grid component is rendered; modules registered after grid creation are ignored
- **`autoHeight` performance**: Never use `domLayout='autoHeight'` for grids with more than 1 000 rows — it renders all rows in the DOM and will freeze the browser
- **Initial options**: Grid options marked `[Initial]` (e.g. `rowModelType`, `treeData`, `masterDetail`) cannot be changed after the grid is created — the grid must be destroyed and re-created
- **SSRM + Client-Side**: A grid can only use one row model — SSRM and Client-Side are mutually exclusive
- **Pivot requires aggregation**: Pivot mode (`pivotMode: true`) only shows aggregated rows; every value column must have an `aggFunc`
- **Module cherry-picking**: When using individual modules, always include `ClientSideRowModelModule` (or `ServerSideRowModelModule`) explicitly — it is not auto-included
