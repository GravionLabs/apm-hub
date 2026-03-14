# Shared Configuration Sync - Quick Start


Documentation for synchronizing shared configuration files (`.github/instructions`, `.github/prompts`, `.github/agents`).

## For Developers in a Hurry

### GitHub - 5 Minute Setup

```bash
# 1. Create sync config
cat > .github/sync-config.json <<'EOF'
{
  "syncSettings": {
    "type": "github",
    "org": "yourorg",
    "repo": "copilot-hub",
    "branch": "main",
    "sourceDir": "templates",
    "targetDir": ".github"
  },
  "files": [
    "instructions/python.instructions.md",
    "instructions/python-pytest.instructions.md",
    "instructions/security.instructions.md",
    "agents/security.agent.md"
  ]
}
EOF

# 2. Copy GitHub Action
cp .github/workflows/sync-shared-config.yml.example \
   .github/workflows/sync-shared-config.yml

# 3. Commit
git add .github/sync-config.json .github/workflows/sync-shared-config.yml
git commit -m "Add shared config sync"
git push

# 4. Test manually
gh workflow run sync-shared-config.yml
gh run watch
```

### Azure DevOps - 5 Minute Setup

```bash
# 1. Create sync config
cat > .github/sync-config.json <<'EOF'
{
  "syncSettings": {
    "type": "azure-repos",
    "org": "yourorg",
    "project": "YourProject",
    "repo": "copilot-hub",
    "branch": "main",
    "sourceDir": "templates",
    "targetDir": ".github"
  },
  "files": [
    "instructions/python.instructions.md",
    "instructions/python-pytest.instructions.md",
    "instructions/security.instructions.md"
  ]
}
EOF

# 2. Copy pipeline
cp azure-pipelines-sync-config.yml.example \
   azure-pipelines-sync-config.yml

# 3. Commit and push
git add .github/sync-config.json azure-pipelines-sync-config.yml
git commit -m "Add shared config sync"
git push

# 4. Create pipeline
az pipelines create \
  --name 'Sync Shared Configuration' \
  --repository trading-engine \
  --branch main \
  --yml-path azure-pipelines-sync-config.yml

# 5. Test manually
az pipelines run --name 'Sync Shared Configuration'
```

## Customize Configuration

Adapt `.github/sync-config.json` to your needs. You can choose between `github` and `azure-repos` as source type.

```json
{
  "syncSettings": {
    "type": "github",
    "org": "yourorg",
    "repo": "copilot-hub",
    "branch": "main"
  },
  "files": [
    { "source": "templates/instructions/python.instructions.md", "dest": ".github/instructions/python.instructions.md" },
    { "source": "templates/agents/security.agent.md", "dest": ".github/agents/security.agent.md" }
  ]
}
```

## Common Files

| File | Description | Recommended for |
|-------|--------------|---------------|
| `python.instructions.md` | Python Standards | All Python Projects |
| `python-pytest.instructions.md` | Pytest Testing | Python with Tests |
| `python-mcp-server.instructions.md` | MCP Server Guidelines | MCP-based Projects |
| `security.instructions.md` | Security Best Practices | **All Projects** |
| `docker.instructions.md` | Docker Guidelines | Containerized Apps |
| `typescript.instructions.md` | TypeScript Standards | TS/JS Projects |

## Testing

**GitHub:**
```bash
# Trigger manually
gh workflow run sync-shared-config.yml

# Check status
gh run list --workflow=sync-shared-config.yml

# View logs
gh run view --log
```

**Azure DevOps:**
```bash
# Trigger manually
az pipelines run --name 'Sync Shared Configuration'

# Check status
az pipelines runs list --pipeline-ids $(az pipelines show --name 'Sync Shared Configuration' --query id -o tsv)
```

## Next Steps

1. ✅ Setup complete? → Wait for first automatic sync (Monday 2 AM)
2. 📖 More details? → See [full documentation](shared-config-sync.md)
3. ❓ Problems? → See [Troubleshooting](shared-config-sync.md#troubleshooting)

## Help

```bash
# View Pipeline/Action Logs
# GitHub: https://github.com/yourorg/yourrepo/actions
# Azure: https://dev.azure.com/yourorg/YourProject/_build

# If problems occur: Contact Platform Team
```
