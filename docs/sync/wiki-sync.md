cr# GitHub Wiki Sync

copilot-hub automatically synchronizes its documentation to the **GitHub Wiki** after every push to `main`.

---

## How It Works

The workflow `.github/workflows/sync-wiki.yml` runs on every push to `main` that touches `README.md` or any file under `docs/`. It:

1. Clones the wiki repository (`<repo>.wiki.git`)
2. Copies `README.md` → `Home.md` (the wiki landing page)
3. Mirrors all `docs/**/*.md` files with path-based naming (e.g. `docs/concepts/plugins.md` → `Concepts-Plugins.md`)
4. Commits and pushes if any files changed

---

## Enabling the Wiki

> The GitHub Wiki must be **enabled** before the sync workflow can push to it.

To enable it:

1. Go to the repository on GitHub
2. Click **Settings** → **General**
3. Scroll to **Features**
4. Check **✅ Wikis**
5. Click Save

The workflow handles initialization automatically — on the first run after enabling the wiki it creates the initial `Home.md` page and pushes it, then continues with the full sync. No manual page creation is needed.

---

## File Name Mapping

Wiki pages cannot have subdirectories — paths are flattened using title-case and dashes:

| Source file                       | Wiki page name               |
| :-------------------------------- | :--------------------------- |
| `README.md`                       | `Home.md`                    |
| `docs/overview.md`                | `Overview.md`                |
| `docs/concepts/plugins.md`        | `Concepts-Plugins.md`        |
| `docs/sync/copilot-workspace.md`  | `Sync-Copilot-Workspace.md`  |
| `docs/usage/how-to-use-agents.md` | `Usage-How-To-Use-Agents.md` |

---

## Manual Trigger

The workflow can also be triggered manually:

```bash
gh workflow run sync-wiki.yml
```

Or via the **Actions** tab on GitHub → **Sync Wiki** → **Run workflow**.

---

## Related

- [Workflow file](.../../.github/workflows/sync-wiki.yml)
- [Overview](../overview.md)
