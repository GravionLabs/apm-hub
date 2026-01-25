# Shared Configuration Architecture


Architecture overview for the Shared Configuration Sync System.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Central Repository                        │
│              github-copilot-templates (main)                 │
│                                                              │
│  templates/                                                  │
│  ├── instructions/                                           │
│  │   ├── python.instructions.md          ◄──── Maintainer   │
│  │   ├── python-pytest.instructions.md         Updates      │
│  │   ├── security.instructions.md                           │
│  │   └── ...                                                 │
│  ├── prompts/                                                │
│  │   └── code-review.prompt.md                               │
│  └── agents/                                                 │
│      └── security.agent.md                                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP API / Git Protocol
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Project A  │  │   Project B  │  │   Project C  │
│              │  │              │  │              │
│ Sync Config: │  │ Sync Config: │  │ Sync Config: │
│ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │
│ │files:    │ │  │ │files:    │ │  │ │files:    │ │
│ │- python  │ │  │ │- ts      │ │  │ │- python  │ │
│ │- pytest  │ │  │ │- react   │ │  │ │- docker  │ │
│ │- security│ │  │ │- security│ │  │ │- security│ │
│ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │
│  ┌───┴────┐  │  │  ┌───┴────┐  │  │  ┌───┴────┐  │
│  │Pipeline│  │  │  │ Action │  │  │  │Pipeline│  │
│  │Schedule│  │  │  │ Cron   │  │  │  │Schedule│  │
│  │OR Shell│  │  │  │ OR Shell│  │  │  │OR Shell│  │
│  └────────┘  │  │  └────────┘  │  │  └────────┘  │
│  Mon 02:00   │  │  Mon 02:00   │  │  Mon 02:00   │
│ (Manual OK)  │  │ (Manual OK)  │  │ (Manual OK)  │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Data Flow

### 1. Initial Synchronization

```
Developer                 Project Repo                Central Repo
    │                          │                            │
    │ 1. Create                │                            │
    │ sync-config.json         │                            │
    ├─────────────────────────►│                            │
    │                          │                            │
    │ 2. Setup                 │                            │
    │ Pipeline/Action          │                            │
    ├─────────────────────────►│                            │
    │                          │                            │
    │ 3. Trigger Sync          │                            │
    ├─────────────────────────►│                            │
    │                          │                            │
    │                          │ 4. Read sync-config.json   │
    │                          ├──────┐                     │
    │                          │      │                     │
    │                          │◄─────┘                     │
    │                          │                            │
    │                          │ 5. Fetch files (API/HTTP)  │
    │                          ├───────────────────────────►│
    │                          │                            │
    │                          │ 6. Return file content     │
    │                          │◄───────────────────────────┤
    │                          │                            │
    │                          │ 7. Write files             │
    │                          ├──────┐                     │
    │                          │      │                     │
    │                          │◄─────┘                     │
    │                          │                            │
    │                          │ 8. Git commit & push       │
    │                          ├──────┐                     │
    │                          │      │                     │
    │                          │◄─────┘                     │
    │                          │                            │
    │ 9. Success notification  │                            │
    │◄─────────────────────────┤                            │
```

### 2. Automatic Updates

```
Maintainer          Central Repo          Project Repos
    │                     │                      │
    │ 1. Update           │                      │
    │ instruction         │                      │
    ├────────────────────►│                      │
    │                     │                      │
    │                     │ 2. Commit & Push     │
    │                     ├──────┐               │
    │                     │      │               │
    │                     │◄─────┘               │
    │                     │                      │
    │                     │                      │
    │                     │◄─────────────────────┤
    │                     │  (Cron: Mon 02:00)   │
    │                     │                      │
    │                     │ 3. Fetch updated     │
    │                     │◄─────────────────────┤
    │                     │                      │
    │                     │ 4. Return new content│
    │                     ├─────────────────────►│
    │                     │                      │
    │                     │                      │ 5. Write & Commit
    │                     │                      ├──────┐
    │                     │                      │      │
    │                     │                      │◄─────┘
    │                     │                      │
    │  6. Notification    │                      │
    │  (optional)         │                      │
    │◄────────────────────┼──────────────────────┤
```

## Component Architecture

### GitHub Actions Variant

```
┌─────────────────────────────────────────────────────┐
│              GitHub Actions Workflow                 │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │ 1. Trigger (Schedule/Manual)                │    │
│  └───────────────┬────────────────────────────┘    │
│                  │                                   │
│  ┌───────────────▼────────────────────────────┐    │
│  │ 2. Checkout Repository                      │    │
│  │    uses: actions/checkout@v4                │    │
│  └───────────────┬────────────────────────────┘    │
│                  │                                   │
│  ┌───────────────▼────────────────────────────┐    │
│  │ 3. Read sync-config.json                    │    │
│  │    - Parse JSON with jq                     │    │
│  │    - Extract source info                    │    │
│  │    - Extract file list                      │    │
│  └───────────────┬────────────────────────────┘    │
│                  │                                   │
│  ┌───────────────▼────────────────────────────┐    │
│  │ 4. Download Files                           │    │
│  │    For each file in config:                 │    │
│  │    - GET https://raw.githubusercontent.com  │    │
│  │    - Save to target path                    │    │
│  └───────────────┬────────────────────────────┘    │
│                  │                                   │
│  ┌───────────────▼────────────────────────────┐    │
│  │ 5. Check for Changes                        │    │
│  │    git diff --quiet                         │    │
│  └───────────────┬────────────────────────────┘    │
│                  │                                   │
│  ┌───────────────▼────────────────────────────┐    │
│  │ 6. Commit & Push (if changes)               │    │
│  │    git add <files>                          │    │
│  │    git commit -m "chore: sync..."          │    │
│  │    git push                                 │    │
│  └────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### Azure Pipelines Variant

```
┌─────────────────────────────────────────────────────┐
│              Azure Pipeline                          │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │ 1. Trigger (Schedule/Manual)                │    │
│  └───────────────┬────────────────────────────┘    │
│                  │                                   │
│  ┌───────────────▼────────────────────────────┐    │
│  │ 2. Checkout (with persistCredentials)      │    │
│  └───────────────┬────────────────────────────┘    │
│                  │                                   │
│  ┌───────────────▼────────────────────────────┐    │
│  │ 3. Read sync-config.json (Bash Task)       │    │
│  │    - Parse with jq                          │    │
│  │    - Set pipeline variables                 │    │
│  └───────────────┬────────────────────────────┘    │
│                  │                                   │
│  ┌───────────────▼────────────────────────────┐    │
│  │ 4. Download Files (Bash Task)               │    │
│  │    For each file:                           │    │
│  │    - Azure DevOps REST API                  │    │
│  │      OR GitHub Raw URL                      │    │
│  │    - Auth with $(System.AccessToken)        │    │
│  └───────────────┬────────────────────────────┘    │
│                  │                                   │
│  ┌───────────────▼────────────────────────────┐    │
│  │ 5. Commit & Push (Bash Task)                │    │
│  │    git config user.name/email               │    │
│  │    git add + commit + push                  │    │
│  └────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

## API Endpoints

### GitHub Raw Content API

```
GET https://raw.githubusercontent.com/{org}/{repo}/{branch}/{path}

Example:
GET https://raw.githubusercontent.com/yourorg/github-copilot-templates/main/.github/instructions/python.instructions.md

Response: File content (text/plain)
```

### Azure DevOps Git Items API

```
GET https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repo}/items
    ?path={path}
    &versionType=branch
    &version={branch}
    &api-version=7.0

Headers:
  Authorization: Basic base64(:{PAT})

Example:
GET https://dev.azure.com/yourorg/YourProject/_apis/git/repositories/github-copilot-templates/items
    ?path=/.github/instructions/python.instructions.md
    &versionType=branch
    &version=main
    &api-version=7.0

Response: File content (application/json with content field)
```

## Security

### GitHub Actions

```yaml
permissions:
  contents: write  # Required for git push

steps:
  - uses: actions/checkout@v4
    with:
      token: ${{ secrets.GITHUB_TOKEN }}  # Auto-generated
```

**Token Permissions:**
- ✅ Read repository content
- ✅ Write repository content (commit & push)
- ❌ Read other repositories (only if public)

### Azure Pipelines

```yaml
steps:
- checkout: self
  persistCredentials: true

- bash: |
    curl -u ":$(System.AccessToken)" ...
  env:
    SYSTEM_ACCESSTOKEN: $(System.AccessToken)
```

**Token Permissions:**
- ✅ Read source repository
- ✅ Write source repository (via persistCredentials)
- ✅ Read target repository (via Project Collection Build Service)

**Build Service Permissions Required:**
1. Project Settings → Repositories → [Your Repo] → Security
2. Search: "[Project Name] Build Service"
3. Set: "Contribute" = Allow

## Error Handling

```
┌──────────────────┐
│  Sync Process    │
└────────┬─────────┘
         │
    ┌────▼─────┐
    │ Config?  │
    └────┬─────┘
         │ No ──────► Skip (Success)
         │ Yes
    ┌────▼─────┐
    │ Parse    │
    └────┬─────┘
         │ Error ───► Fail (Config invalid)
         │ OK
    ┌────▼─────┐
    │Download  │
    │  File    │
    └────┬─────┘
         │ 404 ─────► Fail (File not found)
         │ 401/403 ─► Fail (Auth error)
         │ 200
    ┌────▼─────┐
    │  Write   │
    └────┬─────┘
         │ Error ───► Fail (Permission)
         │ OK
    ┌────▼─────┐
    │ Commit   │
    └────┬─────┘
         │ No changes ► Success (Already synced)
         │ Changes
    ┌────▼─────┐
    │  Push    │
    └────┬─────┘
         │ Error ───► Fail (Push rejected)
         │ OK
    ┌────▼─────┐
    │ Success  │
    └──────────┘
```

## Performance Considerations

### Scaling

| Factor | Impact | Mitigation |
|--------|--------|------------|
| Number of Projects | Linear | Each project syncs independently |
| Number of Files | Linear | Only configured files |
| File Size | Minimal | Instructions are small (< 50KB) |
| Sync Frequency | Minimal | 1x/week = 52 syncs/year |

### Cost Estimation

**GitHub Actions:**
- Free Tier: 2000 min/month (Public), 500 min/month (Private)
- Sync Duration: ~30 seconds
- For 10 projects: 10 × 4 syncs/month × 0.5 min = 20 min/month
- **Cost: $0** (within Free Tier)

**Azure DevOps:**
- Free Tier: 1800 min/month (1 parallel job)
- Sync Duration: ~30 seconds
- For 10 projects: 10 × 4 syncs/month × 0.5 min = 20 min/month
- **Cost: $0** (within Free Tier)

## Monitoring & Observability

### Metrics

```yaml
# Suggested Metrics
- sync_runs_total (Counter)
- sync_duration_seconds (Histogram)
- sync_files_synced (Gauge)
- sync_errors_total (Counter)
  - by error_type: not_found, auth_error, network_error
```

### Logs

```bash
# Success
✓ Syncing from: yourorg/github-copilot-templates@main
✓ Files to sync: 3
✓ → Syncing: .github/instructions/python.instructions.md
✓   Downloaded successfully
✓ All files synced successfully
✓ Changes committed and pushed

# Error
✗ Failed to download .github/instructions/missing.md (HTTP 404)
```

### Alerting

**Recommended Alerts:**
1. Sync failed > 2x in a row
2. Sync takes > 5 minutes
3. Authentication failed

## Backup & Recovery

### Disaster Recovery

**Scenario: Central Repo deleted**
- Impact: No new syncs possible
- Recovery: Restore from backup or clone from a project
- Prevention: Branch protection + Repository backup

**Scenario: Faulty Instruction deployed**
- Impact: All projects receive faulty config
- Recovery: Revert commit in Central Repo + Re-sync in projects
- Prevention: PR review + Test in staging branch

### Rollback Process

```bash
# 1. In Central Repo: Revert
cd github-copilot-templates
git revert HEAD
git push

# 2. In Projects: Trigger manual sync
gh workflow run sync-shared-config.yml  # GitHub
# or
az pipelines run --name 'Sync Shared Configuration'  # Azure
```

## Future Extensions

### Possible Features

1. **Version Pinning**: Lock to specific version
```json
{
  "source": {
    "type": "github",
    "org": "yourorg",
    "repo": "github-copilot-templates",
    "ref": "v2.3.1"
  }
}
```

2. **Selective Sync**: Only on changes
```yaml
- name: Check if files changed
  run: |
    # Only sync if Central Repo has updates
```

3. **Multi-Source**: Multiple Central Repos
```json
{
  "sources": [
    {"type": "github", "org": "org1", "repo": "repo1"},
    {"type": "azure-repos", "org": "org2", "repo": "repo2"}
  ]
}
```

4. **Validation**: Pre-Sync Validation
```yaml
- name: Validate instructions
  run: |
    # Validate YAML frontmatter
    # Test glob patterns
```

---

**Documentation Version**: 1.0
**Last Updated**: 2026-01-25
