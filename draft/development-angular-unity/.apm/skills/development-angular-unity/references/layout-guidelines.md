# Layout Guidelines

Global design guidelines for structuring RWE Unity application layouts. These guidelines define how to use the `rwe-application-frame` and its child zone components consistently across all applications.

---

## Overview

A Unity application is built with `rwe-application-frame` as the outermost shell. It provides named **zones** for each structural area: `rwe-header`, `rwe-aside-left`, `rwe-aside-right`, `rwe-main`, and `rwe-footer`.

---

## Header Guidelines

### Purpose

The header is the primary navigation and orientation point. It must be consistent across all pages, providing:

- **Brand Identity** – always display the app logo so users know which application they are in
- **Primary Navigation** – main nav items for moving between key sections
- **Global Actions** – search, notifications, settings, user account accessible from everywhere
- **Context & Settings** – theme switch, language selector, app switcher

### Three-Slot Layout

`rwe-header` uses three content-projection slots:

| Slot         | Element                              | Typical content                     |
| ------------ | ------------------------------------ | ----------------------------------- |
| `rwe-left`   | Leftmost area (after sidebar-toggle) | `rwe-nav-bar` (max 7 items)         |
| `rwe-center` | Centered area                        | `rwe-app-logo` or `rwe-create-logo` |
| `rwe-right`  | Rightmost area                       | Global actions, search, user menu   |

### Slot-Specific Rules

**`rwe-center`**

- Use `rwe-app-logo` (recommended) or `rwe-create-logo`
- Avoid using plain `rwe-logo` without a context component
- The logo must be clearly visible and appropriately sized

**`rwe-left`**

- Place `rwe-nav-bar` here for top-level navigation
- Limit to **7 items maximum** – must not overlap the app logo
- The sidebar toggle button is built into `rwe-header` and always sits on the outermost left

**`rwe-right`**

- Place global actions using `rwe-icon-button`
- Global search goes here using `rwe-form-input` or `rwe-form-autocomplete`
- Limit to **7 items maximum** – must not overlap the app logo
- **Recommended order** (right to left): `rwe-user` → `rwe-app-menu` → `rwe-theme-menu` → `rwe-language-menu`
- Additional custom actions go before those standard items; search field goes before the custom actions

---

## Aside Guidelines

### General Rules

Aside components provide dedicated spaces for **global functionalities** accessible throughout the application. They act as overlay panels that can be opened and closed without disrupting the main content.

- **Global scope only** – do not put feature-specific sidebars inside `rwe-aside-left`/`rwe-aside-right`; feature sidebars belong inside the main content area
- **Overlay pattern** – typically use `mode="over"` to signal global interaction rather than page navigation
- **Single purpose** – each aside must have one clear purpose
- **Easy dismissal** – users must be able to close via clicking outside, pressing Escape, or an explicit close button

### `rwe-aside-left` – Global Navigation

The left aside is for the **main application navigation menu**.

Best practices:

- Place `rwe-navigation` inside for the primary navigation tree
- Support hierarchical structure with expandable sections
- Always indicate the currently active item
- On mobile/small screens use `mode="over"` (hamburger trigger in header); on desktop use `mode="side"` when appropriate
- Keep consistent width that balances label visibility with screen real estate

### `rwe-aside-right` – Global Actions & Contextual Information

The right aside is for **global actions, notifications, contextual help, and lightweight forms**.

Best practices:

- **Quick actions** – report issue, create item, quick settings (non-disruptive, completable within the panel)
- **Notifications & activity feeds** – real-time updates that don't interrupt the current task
- **Contextual help** – context-sensitive documentation without full-page navigation
- **Quick forms** – lightweight single-purpose forms (issue report, feedback, quick data entry)
- **Supplementary info panels** – system status, user stats, recent activities
- **Width** – keep between 300–400 px

Common use cases: report error/exception/outage, show notifications, quick settings access, contextual information.

---

## Main Content Area Guidelines

### Purpose

`rwe-main` is the central workspace where users interact with features and data. Render feature routes here via `router-outlet`.

### Standard Three-Column Feature Layout

Most feature pages follow this pattern inside the main area:

| Column           | Purpose                       | Components                                                                                   |
| ---------------- | ----------------------------- | -------------------------------------------------------------------------------------------- |
| Left sidebar     | Filter / Search               | `rwe-details-frame`, `rwe-form-autocomplete`, `rwe-form-select`, `rwe-form-datepicker-range` |
| Center           | Content, data, visualizations | `rwe-table`, `rwe-card`, `echarts`, forms                                                    |
| Right action bar | Feature-level actions         | `rwe-navigation` (action slots), `rwe-icon-button`                                           |

### Filter / Search Sidebar (Left)

- Place feature-level filter and search in a **left sidebar**
- Benefits: consistent discoverability, vertical layout handles many filters, easily collapsible on small screens

### Action Bar (Right)

- Place feature-level actions in a **right action bar**
- Use `rwe-navigation` with action-type routes or individual `rwe-icon-button` elements
- Actions remain visible regardless of content scroll position; group logically (edit, delete, export)

Alternatively use `rwe-details-frame` or `rwe-action` slot components for the same layout.

### Content Area Best Practices

- **Data visualization**: use `echarts` for charts/metrics, `rwe-table` for structured tabular data, forms for data entry
- **Content grouping**: wrap related sections in `rwe-card` to create visual hierarchy and improve scannability
- **Sub-navigation**: use `rwe-nav-tabs` for intra-feature navigation without leaving the feature context
- **Information density**: apply progressive disclosure – show essentials first, expand for details
- **Spacing**: use `rwe-padding-*` / `rwe-margin-*` utility classes consistently; avoid custom inline spacing
- **Responsive**: the main area must adapt gracefully; collapse sidebars on smaller viewports

---

## Footer Guidelines

### Purpose

The footer must be consistently included in every application layout. Its primary functions are:

- **Environment identification** – visually distinguishes production from non-production environments (red footer on non-production prevents accidental critical operations)
- **Version information** – app version (and optionally API version) for debugging and support
- **Global navigation** – quick links to legal, privacy, terms of service, help, or contact pages
- **Consistent positioning** – always at the bottom of the layout, always visible

### Environment Visualization

| Environment                   | Appearance                                          |
| ----------------------------- | --------------------------------------------------- |
| `Production`                  | Normal footer (no warning color)                    |
| `Testing` / `Staging` / other | **Red footer** to prevent confusion with production |

Use `warn="auto"` to let the component decide based on the `environment` prop.
