# Shared Configuration Sync


Documentation for synchronizing shared configuration files (`.github/instructions`, `.github/prompts`, `.github/agents`) from a central repository.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [GitHub Setup](#github-setup)
- [Azure DevOps Setup](#azure-devops-setup)
- [Configuration](#configuration)
- [Usage](#usage)
- [Troubleshooting](#troubleshooting)

---

## Overview

Instead of copying `.github/instructions`, `.github/prompts` and `.github/agents` into every repository, these files are centrally managed and automatically synchronized.

### Benefits

- ✅ **Central Management**: Changes to instructions only need to be made once
- ✅ **Consistency**: All projects use the same standards
- ✅ **Flexibility**: Each project can select which files it needs
- ✅ **Version Control**: Changes are tracked via Git
- ✅ **Automation**: Weekly updates via Pipeline/Action

### Workflow

```
┌─────────────────────────────────┐
│  Central Repository             │
│  copilot-hub       │
│                                 │
│  templates/                     │
│  ├── instructions/              │
│  │   ├── python.instructions.md │
│  │   ├── python-pytest.*.md     │
│  │   └── security.*.md          │
│  ├── prompts/                   │
│  │   └── code-review.prompt.md  │
│  └── agents/                    │
│      └── security.agent.md      │
└─────────────────────────────────┘
           │
           │ Sync (automatic/manual)
           ├────────────────┬────────────────┐
           ▼                ▼                ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │ Project A   │  │ Project B   │  │ Project C   │
    │ (Python)    │  │ (TypeScript)│  │ (Python)    │
    └─────────────┘  └─────────────┘  └─────────────┘
```

---

## Architecture

### Components

1. **Central Repository** (`copilot-hub`)
   - Contains all shared configuration files
   - Single Source of Truth

2. **Project Repositories** (e.g., `trading-engine`)
   - Contain a sync configuration (`.github/sync-config.json`)
   - Define which files they need
   - Run automated sync jobs

3. **Sync Mechanism**
   - GitHub Actions (for GitHub)
   - Azure Pipelines (for Azure DevOps)

---

## GitHub Setup

### 1. Create Central Repository

```bash
# Create new repository
mkdir copilot-hub
cd copilot-hub
git init

# Create structure
mkdir -p templates/instructions
mkdir -p templates/prompts
mkdir -p templates/agents

# Create example files
cat > templates/instructions/python.instructions.md <<'EOF'
---
description: 'Python coding standards'
applyTo: '**/*.py'
---

# Python Guidelines

- Use type hints
- Follow PEP 8
- Maximum line length: 120 characters
EOF

cat > templates/instructions/python-pytest.instructions.md <<'EOF'
---
description: 'Guidelines for Python testing with pytest'
applyTo: '**/tests/**/*.py, **/test_*.py'
---

# Python Testing with pytest

- Use `@pytest.mark.unit` for unit tests
- Use `@pytest.mark.integration` for integration tests
EOF

# Commit and push
git add .
git commit -m "Initial shared configuration"
git remote add origin https://github.com/yourorg/copilot-hub.git
git push -u origin main
```

### 2. Sync Configuration in Project Repository

```bash
cd /path/to/your/project
```

Create `.github/sync-config.json`:

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
    { "source": "templates/instructions/security.instructions.md", "dest": ".github/instructions/security.instructions.md" },
    { "source": "templates/agents/security.agent.md", "dest": ".github/agents/security.agent.md" }
  ]
}
```

### 3. Create GitHub Action

Create `.github/workflows/sync-shared-config.yml`:

```yaml
name: Sync Shared Configuration

on:
  # Weekly on Mondays at 2 AM
  schedule:
    - cron: '0 2 * * 1'

  # Manual trigger
  workflow_dispatch:

  # Optional: Check on every push
  # push:
  #   branches: [main]

permissions:
  contents: write

jobs:
  sync:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Read sync configuration
        id: config
        run: |
          if [ ! -f .github/sync-config.json ]; then
            echo "No sync config found, skipping..."
            echo "skip=true" >> $GITHUB_OUTPUT
            exit 0
          fi

          # Extract source info
          ORG=$(jq -r '.syncSettings.org' .github/sync-config.json)
          REPO=$(jq -r '.syncSettings.repo' .github/sync-config.json)
          BRANCH=$(jq -r '.syncSettings.branch' .github/sync-config.json)

          echo "org=$ORG" >> $GITHUB_OUTPUT
          echo "repo=$REPO" >> $GITHUB_OUTPUT
          echo "branch=$BRANCH" >> $GITHUB_OUTPUT
          echo "skip=false" >> $GITHUB_OUTPUT

      - name: Sync shared files
        if: steps.config.outputs.skip != 'true'
        run: |
          ORG="${{ steps.config.outputs.org }}"
          REPO="${{ steps.config.outputs.repo }}"
          BRANCH="${{ steps.config.outputs.branch }}"

          echo "Syncing from: $ORG/$REPO@$BRANCH"

          # Download each file from config
          jq -c '.files[]' .github/sync-config.json | while read -r file_entry; do
            SOURCE=$(echo $file_entry | jq -r '.source')
            DEST=$(echo $file_entry | jq -r '.dest')
            
            echo "  → Downloading $SOURCE to $DEST"

            # Create directory if needed
            mkdir -p "$(dirname "$DEST")"

            # Download file from GitHub Raw
            URL="https://raw.githubusercontent.com/$ORG/$REPO/$BRANCH/$SOURCE"

            HTTP_CODE=$(curl -sL -w "%{http_code}" "$URL" -o "$DEST")

            if [ "$HTTP_CODE" = "200" ]; then
              echo "    ✓ Downloaded successfully"
            else
              echo "    ✗ Failed (HTTP $HTTP_CODE)"
              exit 1
            fi
          done

          echo ""
          echo "✓ All files synced successfully"

      - name: Check for changes
        id: changes
        run: |
          git diff --quiet . || echo "changed=true" >> $GITHUB_OUTPUT

      - name: Commit and push
        if: steps.changes.outputs.changed == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

          # Only add files from sync-config
          jq -c '.files[]' .github/sync-config.json | while read -r file_entry; do
            DEST=$(echo $file_entry | jq -r '.dest')
            if [ "$DEST" = "null" ]; then DEST=$(echo $file_entry | jq -r '.source'); fi
            git add "$DEST"
          done

          CHANGED_FILES=$(git diff --staged --name-only | wc -l)
          git commit -m "chore: sync $CHANGED_FILES shared config file(s) [skip ci]"
          git push

          echo "✓ Changes committed and pushed"
```

### 4. Commit Action and Test

```bash
git add .github/sync-config.json
git add .github/workflows/sync-shared-config.yml
git commit -m "Add shared config sync workflow"
git push

# Trigger manually
gh workflow run sync-shared-config.yml

# Check status
gh run list --workflow=sync-shared-config.yml
```

---

## Azure DevOps Setup

### 1. Create Central Repository

```bash
# Create repository in Azure DevOps
az repos create \
  --name copilot-hub \
  --project YourProject \
  --org https://dev.azure.com/yourorg

# Initialize locally
mkdir copilot-hub
cd copilot-hub
git init

# Create structure as shown in GitHub setup (step 1)
mkdir -p .github/instructions
mkdir -p .github/prompts

# ... (create files as in GitHub example)

# Add remote and push
git remote add origin https://dev.azure.com/yourorg/YourProject/_git/copilot-hub
git add .
git commit -m "Initial shared configuration"
git push -u origin main
```

### 2. Sync Configuration in Project Repository

Create `.github/sync-config.json`:

```json
{
  "syncSettings": {
    "type": "azure-repos",
    "org": "yourorg",
    "project": "YourProject",
    "repo": "copilot-hub",
    "branch": "main"
  },
  "files": [
    { "source": "templates/instructions/python.instructions.md", "dest": ".github/instructions/python.instructions.md" },
    { "source": "templates/instructions/python-pytest.instructions.md", "dest": ".github/instructions/python-pytest.instructions.md" },
    { "source": "templates/instructions/security.instructions.md", "dest": ".github/instructions/security.instructions.md" }
  ]
}
```

### 3. Create Azure Pipeline

Create `azure-pipelines-sync-config.yml`:

```yaml
name: Sync Shared Configuration

# Only scheduled or manual
trigger: none
pr: none

schedules:
  - cron: "0 2 * * 1"  # Mondays at 2 AM UTC
    displayName: Weekly sync
    branches:
      include:
        - main
    always: true

pool:
  vmImage: 'ubuntu-latest'

steps:
  - checkout: self
    persistCredentials: true

  - task: Bash@3
    displayName: 'Read sync configuration'
    name: ReadConfig
    inputs:
      targetType: 'inline'
      script: |
        CONFIG_FILE=".github/sync-config.json"

        if [ ! -f "$CONFIG_FILE" ]; then
          echo "⚠️  No sync config found at $CONFIG_FILE"
          echo "##vso[task.complete result=SucceededWithIssues;]No sync config"
          exit 0
        fi

        echo "Reading configuration from $CONFIG_FILE"

        SOURCE_TYPE=$(jq -r '.syncSettings.type' "$CONFIG_FILE")
        SOURCE_ORG=$(jq -r '.syncSettings.org' "$CONFIG_FILE")
        SOURCE_PROJECT=$(jq -r '.syncSettings.project' "$CONFIG_FILE")
        SOURCE_REPO=$(jq -r '.syncSettings.repo' "$CONFIG_FILE")
        SOURCE_BRANCH=$(jq -r '.syncSettings.branch' "$CONFIG_FILE")

        echo "Source: $SOURCE_TYPE"
        echo "Organization: $SOURCE_ORG"
        echo "Project: $SOURCE_PROJECT"
        echo "Repository: $SOURCE_REPO"
        echo "Branch: $SOURCE_BRANCH"

        # Save as pipeline variables
        echo "##vso[task.setvariable variable=sourceType]$SOURCE_TYPE"
        echo "##vso[task.setvariable variable=sourceOrg]$SOURCE_ORG"
        echo "##vso[task.setvariable variable=sourceProject]$SOURCE_PROJECT"
        echo "##vso[task.setvariable variable=sourceRepo]$SOURCE_REPO"
        echo "##vso[task.setvariable variable=sourceBranch]$SOURCE_BRANCH"
        echo "##vso[task.setvariable variable=configExists]true"

  - task: Bash@3
    displayName: 'Sync shared files'
    condition: eq(variables['configExists'], 'true')
    inputs:
      targetType: 'inline'
      script: |
        set -e

        CONFIG_FILE=".github/sync-config.json"
        SOURCE_TYPE="$(sourceType)"
        SOURCE_ORG="$(sourceOrg)"
        SOURCE_PROJECT="$(sourceProject)"
        SOURCE_REPO="$(sourceRepo)"
        SOURCE_BRANCH="$(sourceBranch)"

        echo "Syncing from: $SOURCE_ORG/$SOURCE_PROJECT/$SOURCE_REPO@$SOURCE_BRANCH"
        echo ""

        FILE_COUNT=$(jq '.files | length' "$CONFIG_FILE")
        echo "Files to sync: $FILE_COUNT"
        echo ""

        # Synchronize each file
        jq -c '.files[]' "$CONFIG_FILE" | while IFS= read -r file_entry; do
          SOURCE=$(echo $file_entry | jq -r '.source')
          DEST=$(echo $file_entry | jq -r '.dest')
          
          # Fallback if dest is not provided
          if [ "$DEST" = "null" ]; then DEST="$SOURCE"; fi

          echo "→ Syncing: $SOURCE to $DEST"
          mkdir -p "$(dirname "$DEST")"

          if [ "$SOURCE_TYPE" = "azure-repos" ]; then
            # Azure DevOps REST API
            API_URL="https://dev.azure.com/$SOURCE_ORG/$SOURCE_PROJECT/_apis/git/repositories/$SOURCE_REPO/items"
            API_URL="$API_URL?path=/$SOURCE&versionType=branch&version=$SOURCE_BRANCH&api-version=7.0"

            HTTP_CODE=$(curl -sL -w "%{http_code}" \
              -u ":$(System.AccessToken)" \
              "$API_URL" \
              -o "$DEST")

          elif [ "$SOURCE_TYPE" = "github" ]; then
            # GitHub Raw Content
            RAW_URL="https://raw.githubusercontent.com/$SOURCE_ORG/$SOURCE_REPO/$SOURCE_BRANCH/$SOURCE"

            HTTP_CODE=$(curl -sL -w "%{http_code}" \
              "$RAW_URL" \
              -o "$DEST")

          else
            echo "  ✗ Unknown source type: $SOURCE_TYPE"
            exit 1
          fi

          if [ "$HTTP_CODE" = "200" ]; then
            echo "  ✓ Downloaded successfully"
          else
            echo "  ✗ Failed (HTTP $HTTP_CODE)"
            exit 1
          fi

          echo ""
        done

        echo "✓ All files synced successfully"
    env:
      SYSTEM_ACCESSTOKEN: $(System.AccessToken)

  - task: Bash@3
    displayName: 'Commit and push changes'
    condition: eq(variables['configExists'], 'true')
    inputs:
      targetType: 'inline'
      script: |
        git config user.email "azure-pipelines[bot]@yourdomain.com"
        git config user.name "Azure Pipelines"

        jq -c '.files[]' .github/sync-config.json | while read -r file_entry; do
          DEST=$(echo $file_entry | jq -r '.dest')
          if [ "$DEST" = "null" ]; then DEST=$(echo $file_entry | jq -r '.source'); fi
          git add "$DEST"
        done

        if git diff --staged --quiet; then
          echo "No changes to commit"
        else
          CHANGED_FILES=$(git diff --staged --name-only | wc -l)
          git commit -m "chore: sync $CHANGED_FILES shared config file(s) [skip ci]"
          git push origin HEAD:$(Build.SourceBranchName)
          echo "✓ Changes committed and pushed"
        fi
```

### 4. Set Up Pipeline in Azure DevOps

**Option A: Via Azure CLI**

```bash
az pipelines create \
  --name 'Sync Shared Configuration' \
  --repository trading-engine \
  --branch main \
  --yml-path azure-pipelines-sync-config.yml \
  --org https://dev.azure.com/yourorg \
  --project YourProject
```

**Option B: Via Web UI**

1. Go to **Pipelines** → **New Pipeline**
2. Select **Azure Repos Git**
3. Select your repository (e.g., `trading-engine`)
4. Select **Existing Azure Pipelines YAML file**
5. Select `/azure-pipelines-sync-config.yml`
6. **Save** (or **Run** for first test)

### 5. Configure Pipeline Permissions

**Important**: The pipeline needs OAuth token access:

1. Go to **Pipeline** → **Edit**
2. Click **⋮** (menu) → **Triggers**
3. Go to **YAML** → **Get sources**
4. Enable: **"Allow scripts to access the OAuth token"**

Or already set in YAML via:
```yaml
- checkout: self
  persistCredentials: true  # ← Enables git push
```

### 6. Test

```bash
# Trigger manually via CLI
az pipelines run \
  --name 'Sync Shared Configuration' \
  --org https://dev.azure.com/yourorg \
  --project YourProject

# Or in Web UI: Pipelines → Run Pipeline
```

## Automation

To ensure that the documentation is always up to date, it is recommended to automate the generation process.

### GitHub Actions
A workflow `docs/sync/.github/workflows/generate-docs.yml` is provided. It automatically regenerates the documentation whenever changes are pushed to `main` (within `templates/` or `src/`).

### Azure DevOps
A pipeline `docs/sync/azure-pipelines-generate-docs.yml` is provided for Azure DevOps users. It offers the same functionality as the GitHub Action.

---

## Configuration

### Sync Config Schema

The easiest way to configure file synchronization is to define the source and target directories once and then just list the relative file paths (or short names) categorized.

```json
{
  "syncSettings": {
    "type": "github",
    "org": "yourorg",
    "repo": "copilot-hub",
    "branch": "main",
    "sourceDir": "templates",
    "targetDir": ".github"
  },
  "instructions": [
    "python",
    "security"
  ],
  "prompts": [
    "code-review"
  ],
  "agents": [
    "security"
  ]
}
```

### Configuration Reference

**Sync Settings (`syncSettings`):**
- `type`: `"github"` or `"azure-repos"` (required)
- `org`: Name of the GitHub/Azure organization (required)
- `repo`: Repository name (required)
- `branch`: Branch to sync from (default: `"main"`)
- `project`: (Azure DevOps only) Project name (required for azure-repos)
- `sourceDir`: Source directory in the repository (default: `"templates"`)
- `targetDir`: Target directory in the project (default: `".github"`)

**Categories:**
- `instructions`: List of instructions (short name like `python` or full name)
- `prompts`: List of prompts (short name like `code-review` or full name)
- `agents`: List of agents (short name like `security` or full name)


Files are automatically synchronized to `targetDir/{category}/{filename}`.

**Legacy Support:**
- `files`: Array of relative paths (e.g., `"instructions/python.instructions.md"`). These are copied directly to `targetDir/{path}`.

### Example Configurations

**Python Project:**
```json
{
  "syncSettings": {
    "type": "github",
    "org": "yourorg",
    "repo": "copilot-hub",
    "branch": "main",
    "sourceDir": "templates",
    "targetDir": ".github"
  },
  "instructions": [
    "python",
    "python-pytest",
    "security"
  ],
  "agents": [
    "security"
  ]
}
```

**TypeScript/React Project (selective files):**
```json
{
  "syncSettings": {
    "type": "azure-repos",
    "org": "yourorg",
    "project": "Frontend",
    "repo": "copilot-hub",
    "branch": "main",
    "sourceDir": "templates",
    "targetDir": ".github"
  },
  "files": [
    "instructions/typescript.instructions.md",
    "instructions/react.instructions.md",
    "instructions/jest.instructions.md",
    "instructions/security.instructions.md",
    "prompts/code-review.prompt.md"
  ]
}
```

**Minimal Project (security only, custom directories):**
```json
{
  "syncSettings": {
    "type": "github",
    "org": "yourorg",
    "repo": "copilot-hub",
    "branch": "main",
    "sourceDir": "templates/instructions",
    "targetDir": ".config/copilot"
  },
  "files": [
    "security.instructions.md"
  ]
}
```

---

## Usage

### Manual Sync

**Setup Prompt:**

The easiest way to set up your `.github/sync-config.json` is to use the **Setup Sync Configuration** prompt. 

1. Open Copilot Chat.
2. Type `/setup-sync-config`.
3. Copilot will analyze your project and suggest a configuration.

**Scripts:**

If you want to trigger the synchronization manually without using the CI/CD pipelines, you can use the provided scripts in the `docs/sync/.github/` directory.

The scripts can be run from the **project root** or directly from the **`.github/`** directory.

**From Project Root:**

- **Shell Script** (Linux/macOS):
  ```bash
  # Ensure the script is executable
  chmod +x docs/sync/.github/sync-shared-config.sh

  # Run the sync
  ./docs/sync/.github/sync-shared-config.sh
  ```

- **PowerShell Script** (Windows):
  ```powershell
  ./docs/sync/.github/sync-shared-config.ps1
  ```

**From `.github/` Directory:**

- **Shell Script**:
  ```bash
  cd .github
  ../docs/sync/.github/sync-shared-config.sh
  ```

- **PowerShell Script**:
  ```powershell
  cd .github
  ../docs/sync/.github/sync-shared-config.ps1
  ```

**GitHub Actions:**
```bash
# Via GitHub CLI
gh workflow run sync-shared-config.yml

# Or via Web UI
# Actions → Sync Shared Configuration → Run workflow
```

**Azure DevOps:**
```bash
# Via Azure CLI
az pipelines run \
  --name 'Sync Shared Configuration' \
  --org https://dev.azure.com/yourorg \
  --project YourProject

# Or via Web UI
# Pipelines → Sync Shared Configuration → Run pipeline
```

### Automatic Sync

Both systems are configured to run **every Monday at 2 AM UTC** automatically.

**Cron Expression:** `0 2 * * 1`
- `0` = Minute 0
- `2` = Hour 2 (UTC)
- `*` = Every day of month
- `*` = Every month
- `1` = Monday (0 = Sunday, 1 = Monday, ...)

**Other Schedules:**

```yaml
# Daily at 3 AM
# cron: '0 3 * * *'

# Every Sunday at 1 AM
# cron: '0 1 * * 0'

# First day of month
# cron: '0 0 1 * *'

# Multiple times daily (6, 12, 18 hours)
# cron: '0 6,12,18 * * *'
```

### Add New File

1. **In central repo** (`copilot-hub`):
```bash
cd copilot-hub

# Create new instruction
cat > .github/instructions/docker.instructions.md <<'EOF'
---
description: 'Docker best practices'
applyTo: '**/Dockerfile, **/docker-compose.yml'
---

# Docker Guidelines
...
EOF

git add .github/instructions/docker.instructions.md
git commit -m "Add Docker instructions"
git push
```

2. **In project repo** (update `.github/sync-config.json`):
```json
{
  "syncSettings": { "type": "github", "org": "yourorg", "repo": "copilot-hub", "branch": "main" },
  "files": [
    { "source": "templates/instructions/python.instructions.md", "dest": ".github/instructions/python.instructions.md" },
    { "source": "templates/instructions/docker.instructions.md", "dest": ".github/instructions/docker.instructions.md" }
  ]
}
```

3. **Run sync** (manually or wait for next automatic run)

### Remove File from Sync

Simply remove from `files` list in `.github/sync-config.json`:

```json
{
  "syncSettings": { "type": "github", "org": "yourorg", "repo": "copilot-hub", "branch": "main" },
  "files": [
    { "source": "templates/instructions/python.instructions.md", "dest": ".github/instructions/python.instructions.md" }
  ]
}
```

**Important**: The file will **not** be automatically deleted, only no longer updated.

To delete it:
```bash
git rm .github/instructions/old.instructions.md
git commit -m "Remove old instruction file"
```

---

## Troubleshooting

### Problem: "No sync config found"

**Cause**: `.github/sync-config.json` is missing or in wrong location.

**Solution**:
```bash
# Check if file exists
ls -la .github/sync-config.json

# If not, create it
cat > .github/sync-config.json <<'EOF'
{
  "syncSettings": {
    "type": "github",
    "org": "yourorg",
    "repo": "copilot-hub",
    "branch": "main"
  },
  "files": [
    ".github/instructions/python.instructions.md"
  ]
}
EOF

git add .github/sync-config.json
git commit -m "Add sync configuration"
git push
```

### Problem: "HTTP 404 - File not found"

**Cause**: File doesn't exist in source repository or path is wrong.

**Solution**:
```bash
# Check in source repo
cd copilot-hub
ls -la .github/instructions/

# Or check via Web UI
# GitHub: https://github.com/yourorg/copilot-hub/tree/main/.github/instructions
# Azure: https://dev.azure.com/yourorg/YourProject/_git/copilot-hub?path=/.github/instructions
```

Ensure that:
- File exists in source repo
- Path in `sync-config.json` is correct (including `.github/` prefix)
- Branch is correct

### Problem: "HTTP 401/403 - Unauthorized"

**GitHub:**
- Check if repository is public or token has access
- For private repos: Ensure `secrets.GITHUB_TOKEN` has permissions

**Azure DevOps:**
- Check pipeline permissions: "Allow scripts to access the OAuth token"
- Check repository permissions for Build Service

**Solution for Azure DevOps:**
1. Go to **Project Settings** → **Repositories** → *Your Repository*
2. Go to **Security**
3. Search for **"[Project Name] Build Service"**
4. Ensure **"Contribute"** is allowed

### Problem: "git push failed"

**Cause**: No permission to push or `persistCredentials` not set.

**GitHub - Solution**:
```yaml
- name: Checkout
  uses: actions/checkout@v4
  with:
    token: ${{ secrets.GITHUB_TOKEN }}  # ← Important
```

**Azure DevOps - Solution**:
```yaml
- checkout: self
  persistCredentials: true  # ← Important
```

### Problem: "jq: command not found"

**Cause**: `jq` is not installed (rare on Ubuntu runners).

**Solution**:
```yaml
# Insert before sync step
- name: Install jq
  run: |
    sudo apt-get update
    sudo apt-get install -y jq
```

### Problem: Sync not running automatically

**Cause**: Cron schedule wrong or not activated.

**GitHub - Solution**:
- Check in Actions → Workflow → Recent runs
- Ensure at least one manual run was successful
- GitHub Actions cron only runs for active repos (last commit < 60 days)

**Azure DevOps - Solution**:
- Check Pipeline → Triggers → Scheduled
- Ensure `always: true` is set
- Check timezone (Azure uses UTC)

### Problem: "Changes not committed"

**Cause**: Either no changes or `.gitignore` blocks files.

**Solution**:
```bash
# Check .gitignore
cat .gitignore | grep instructions

# If instructions are ignored, add exception
echo "!.github/instructions/*.md" >> .gitignore
```

### Enable Debug Mode

**GitHub Actions:**
```yaml
- name: Debug sync
  run: |
    set -x  # Enable verbose mode
    cat .github/sync-config.json
    # ... rest of script
```

**Azure Pipelines:**
```yaml
- task: Bash@3
  inputs:
    script: |
      set -x  # Enable verbose mode
      cat .github/sync-config.json
      # ... rest of script
  env:
    SYSTEM_DEBUG: true  # Enable pipeline debug logs
```

---

## Advanced Scenarios

### Cross-Platform: GitHub → Azure DevOps

```json
{
  "syncSettings": {
    "type": "github",
    "org": "yourorg",
    "repo": "copilot-hub",
    "branch": "main"
  },
  "files": [
    { "source": "templates/instructions/python.instructions.md", "dest": ".github/instructions/python.instructions.md" }
  ]
}
```

Azure Pipeline stays the same - works with both source types!

### Multiple Sources (Advanced)

If you need different configs from different repos:

```json
{
  "syncSettings": [
    {
      "type": "github",
      "org": "yourorg",
      "repo": "shared-python-config",
      "branch": "main",
      "files": [
        ".github/instructions/python.instructions.md",
        ".github/instructions/python-pytest.instructions.md"
      ]
    },
    {
      "type": "azure-repos",
      "org": "yourorg",
      "project": "Security",
      "repo": "security-guidelines",
      "branch": "main",
      "files": [
        ".github/instructions/security.instructions.md"
      ]
    }
  ]
}
```

(Requires adapted pipeline - contact team for implementation)

### Branch-based Configs

For staging/production differences:

```json
{
  "syncSettings": {
    "type": "github",
    "org": "yourorg",
    "repo": "copilot-hub",
    "branch": "staging"
  },
  "files": [
    { "source": "templates/instructions/python.instructions.md", "dest": ".github/instructions/python.instructions.md" }
  ]
}
```

Adapt pipeline to use different configs based on branch.

---

## Best Practices

1. **Small, focused instruction files**: Multiple small files rather than one large
2. **Semantic commit messages**: `chore: sync shared config` instead of `update files`
3. **Review before merge**: Have changes in central repo reviewed
4. **Versioning**: Use tags in central repo for major changes
5. **Documentation**: Document changes in CHANGELOG in central repo
6. **Testing**: Test changes in central repo in a test project first
7. **Use [skip ci]**: Prevents endless pipeline loops

---

## Support

For questions or issues:

1. Check [Troubleshooting](#troubleshooting)
2. Look at Pipeline/Action logs
3. Contact Platform Team

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-25 | Initial documentation |
