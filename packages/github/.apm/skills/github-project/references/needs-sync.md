# Needs sync

`Set-ProjectStandard.ps1 -Sync` calls `Sync-ProjectNeeds.ps1 -Owner <o> -Number <n>` after its own plan, so `sync` sets `Needs` of all open items.

```powershell
pwsh scripts/Sync-ProjectNeeds.ps1 [-Owner <login> -Number <n>] [-Repo owner/repo] [-Issue 12,13] [-IncludeParents] [-DryRun] [-Json]
```

Project lookup without `-Owner`/`-Number`: `.agents/project.json` (`{"owner": "...", "number": 17}`) at the repository root, else `project-url:` in `.github/workflows/add-to-project.yml`. None found: `Needs sync skipped: no project configured`, exit 0.

Rule order, first match wins: closed (clear), label `needs-decision` (Decision), label `needs-review` (Review), blocked-by link to an open, unmerged blocker (Blocked; a closed blocker, label `merged` or Status `In release` counts as resolved), label `merged` or Status `In release` (Release review), open PR for the issue or Status `In Progress` (In progress), Epic without Feature / Feature without PBI / PBI without Task and without label `planned` (Planning), else Ready (Epics and Features: cleared).
