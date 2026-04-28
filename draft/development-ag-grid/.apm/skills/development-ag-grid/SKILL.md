---
name: development-ag-grid
description: >
  Use this skill when building or modifying Angular components that integrate AG Grid Enterprise.
  Covers Enterprise setup, module registration, column definitions, row models (including SSRM),
  filtering, cell rendering, cell editing, row grouping, pivoting, master/detail, Excel export,
  theming, and TypeScript generics. Triggers on tasks like "add ag-grid", "configure columns",
  "enable row grouping", "export to Excel", "set up SSRM", or "customize cell renderer".
allowed-tools: execute shell runCommands read write edit editFiles search codebase mcp_ag-mcp_search_docs mcp_ag-mcp_detect_version mcp_ag-mcp_list_versions mcp_ag-mcp_set_versions
license: MIT
---

## Basic Rules

> **CRITICAL — session startup order:**
> `set_versions` **MUST** be called before the first `search_docs` call in every session.
> Passing `version` and `framework` directly to `search_docs` is **not sufficient** —
> the MCP server requires a session-level default to be registered first via `set_versions`.
> Calling `search_docs` without a prior `set_versions` will return an error regardless of parameters.

If ag‑mcp is available → complete the Version Resolution steps below **first**, then use
`search_docs` to query live AG Grid documentation.
Otherwise fall back to the reference files in `references/`.

### Version Resolution

Execute these steps **before the first `search_docs` call** in any session:

1. **Detect** — find the frontend directory by running PowerShell from the repository root,
   then pass the result to `detect_version`:
   ```powershell
   $root = git rev-parse --show-toplevel
   Get-ChildItem -Path $root -Recurse -Filter package.json |
     Where-Object { (Get-Content $_.FullName -Raw) -match '"ag-grid' } |
     Select-Object -First 1 -ExpandProperty DirectoryName
   ```
2. **List** — run `list_versions` to get all versions available in the MCP server.
3. **Match** — if the detected version is in the list, use it directly.  
   Otherwise, pick the **nearest lower** available version using semver descent:
   - Same major + same minor → highest available patch below detected
   - Same major → highest available minor (with highest patch) below detected
   - Fallback → highest available version overall
4. **Set (MUST)** — call `set_versions(resolved_version, "angular")` to register the resolved
   version as the MCP session default. **This step is mandatory.** Passing `version`/`framework`
   as parameters to `search_docs` directly does not replace this call — the MCP server will
   return an error if `set_versions` has not been called first in the current session.
5. **Inform** — briefly note which version is used for docs queries, e.g.:
   > "Project uses v35.2.1 — MCP docs unavailable for that version, using v35.1.0."

**After `set_versions` succeeds**, call `search_docs` with the resolved version and framework explicitly:
```json
{
  "query": "<your search terms>",
  "version": "<resolved>",
  "framework": "angular"
}
```

- AG Grid version: always verify with `npm ls ag-grid-angular ag-grid-enterprise` before making changes
- Enterprise is the standard — use `AllEnterpriseModule`, never `AllCommunityModule` on its own
- `LicenseManager.setLicenseKey()` must be called **before** `ModuleRegistry.registerModules()`
- Modules must be registered before any grid is instantiated
- `AgGridAngular` is a standalone Angular component — always add it to the `imports` array
- Prefer cherry-picked modules over `AllEnterpriseModule` in production to minimise bundle size

## Enterprise Setup

> MCP: `search_docs("ag grid enterprise setup license key AllEnterpriseModule module registration")`  
> Fallback: [enterprise-setup.md](references/enterprise-setup.md)

Read when:

- Setting up AG Grid Enterprise for the first time
- Configuring the license key
- Deciding between `AllEnterpriseModule` and individual modules

## Modules

> MCP: `search_docs("ag grid module registration cherry-pick AllEnterpriseModule ValidationModule")`  
> Fallback: [modules.md](references/modules.md)

Read when:

- Registering modules (globally or per grid)
- Cherry-picking individual modules to reduce bundle size
- Adding `ValidationModule` for development warnings
- Providing modules to individual grids via `[modules]` binding

## Column Definitions

> MCP: `search_docs("ag grid ColDef defaultColDef valueGetter valueFormatter columnTypes cell data types pinned")`  
> Fallback: [column-definitions.md](references/column-definitions.md)

Read when:

- Defining `ColDef` or `defaultColDef`
- Using `columnTypes`, `valueGetter`, `valueFormatter`, or `valueParser`
- Configuring cell data types or pinned columns
- Dynamically adding, removing, or updating column definitions

## Row Data & Row Models

> MCP: `search_docs("ag grid CSRM SSRM server-side row model datasource lazy loading large datasets")`  
> Fallback: [row-models.md](references/row-models.md)

Read when:

- Choosing between Client-Side Row Model (CSRM) and Server-Side Row Model (SSRM)
- Implementing an SSRM datasource
- Handling large datasets (>100k rows)
- Configuring lazy loading or server-side grouping/pivoting

## Grid API & Events

> MCP: `search_docs("ag grid API setGridOption updateGridOptions events cellValueChanged selectionChanged gridReady")`  
> Fallback: [grid-api-events.md](references/grid-api-events.md)

Read when:

- Accessing the grid API via `@ViewChild` or the `gridReady` event
- Calling `api.setGridOption()` or `api.updateGridOptions()`
- Subscribing to grid events (e.g., `cellValueChanged`, `selectionChanged`, `rowDataUpdated`)
- Refreshing rows or cells programmatically

## Filtering

> MCP: `search_docs("ag grid column filter quick filter external filter advanced filter agTextColumnFilter")`  
> Fallback: [filtering.md](references/filtering.md)

Read when:

- Configuring column filters (`filter: 'agTextColumnFilter'` etc.)
- Adding a Quick Filter (search box)
- Using External Filter via `isExternalFilterPresent` / `doesExternalFilterPass`
- Enabling Advanced Filter (Enterprise)

## Cell Rendering

> MCP: `search_docs("ag grid custom cell renderer ICellRendererAngularComp Angular component cellRendererSelector")`  
> Fallback: [cell-rendering.md](references/cell-rendering.md)

Read when:

- Creating a custom Angular cell renderer component implementing `ICellRendererAngularComp`
- Using a function renderer for simple cases
- Using `cellRendererSelector` for dynamic renderer selection per row

## Cell Editing

> MCP: `search_docs("ag grid cell editor ICellEditorAngularComp editable cellValueChanged agTextCellEditor agRichSelectCellEditor")`  
> Fallback: [cell-editing.md](references/cell-editing.md)

Read when:

- Enabling editing with `editable: true` (static or callback)
- Creating a custom Angular cell editor implementing `ICellEditorAngularComp`
- Handling `cellValueChanged` or `cellEditingStopped` events
- Using provided editors (`agTextCellEditor`, `agSelectCellEditor`, `agRichSelectCellEditor`)

## Row Grouping & Pivoting

> MCP: `search_docs("ag grid row grouping aggFunc autoGroupColumnDef singleColumn multipleColumns groupRows")`  
> Fallback: [row-grouping.md](references/row-grouping.md)

Read when:

- Enabling `rowGroup: true` on column definitions
- Configuring aggregation with `aggFunc`
- Customising group display type (`singleColumn`, `multipleColumns`, `groupRows`)
- Configuring `autoGroupColumnDef`

> MCP: `search_docs("ag grid pivot mode pivotMode aggFunc side bar column pivot")`  
> Fallback: [pivoting.md](references/pivoting.md)

Read when:

- Enabling `pivotMode: true`
- Setting `pivot: true` on a column
- Combining row grouping, aggregation, and pivoting
- Configuring the Side Bar for user-driven pivot control

## Master / Detail

> MCP: `search_docs("ag grid master detail detailCellRendererParams detailGridOptions getDetailRowData isRowMaster")`  
> Fallback: [master-detail.md](references/master-detail.md)

Read when:

- Enabling `masterDetail: true`
- Configuring `detailCellRendererParams` with `detailGridOptions` and `getDetailRowData`
- Using a custom Angular component as the detail cell renderer
- Determining which rows are master rows via `isRowMaster`

## Excel Export

> MCP: `search_docs("ag grid exportDataAsExcel Excel export styles multiple sheets header footer images")`  
> Fallback: [excel-export.md](references/excel-export.md)

Read when:

- Calling `api.exportDataAsExcel()`
- Customising exported columns, rows, or styles
- Exporting to multiple sheets
- Adding extra content (headers, footers, images)

## Theming & Layout

> MCP: `search_docs("ag grid theme agThemeQuartz agThemeAlpine CSS variables domLayout provideGlobalGridOptions")`  
> Fallback: [theming.md](references/theming.md)

Read when:

- Selecting or customising a built-in theme (`agThemeAlpine`, `agThemeBalham`, `agThemeQuartz`)
- Using `provideGlobalGridOptions` for app-wide defaults
- Setting `domLayout` (`normal`, `autoHeight`, `print`)
- Customising theme colours via CSS variables

## TypeScript Generics

> MCP: `search_docs("ag grid TypeScript generics GridOptions ColDef TData typed events callbacks")`  
> Fallback: [typescript-generics.md](references/typescript-generics.md)

Read when:

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
