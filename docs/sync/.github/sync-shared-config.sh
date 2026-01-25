#!/bin/bash

# Shared Configuration Sync Script (Shell)
# Synchronizes shared .github configuration files from a central repository.

set -e

CONFIG_FILE=".github/sync-config.json"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Sync configuration file $CONFIG_FILE not found."
    exit 1
fi

echo "Reading configuration from $CONFIG_FILE..."

SOURCE_TYPE=$(jq -r '.source.type' "$CONFIG_FILE")
SOURCE_ORG=$(jq -r '.source.org' "$CONFIG_FILE")
SOURCE_REPO=$(jq -r '.source.repo' "$CONFIG_FILE")
SOURCE_BRANCH=$(jq -r '.source.branch' "$CONFIG_FILE")
SOURCE_PROJECT=$(jq -r '.source.project // empty' "$CONFIG_FILE")

echo "Source: $SOURCE_TYPE"
echo "Organization: $SOURCE_ORG"
echo "Repository: $SOURCE_REPO"
echo "Branch: $SOURCE_BRANCH"

FILE_COUNT=$(jq '.files | length' "$CONFIG_FILE")
echo "Files to sync: $FILE_COUNT"
echo ""

# Download each file
jq -r '.files[]' "$CONFIG_FILE" | while IFS= read -r file; do
    echo "→ Syncing: $file"
    
    # Create directory if it doesn't exist
    mkdir -p "$(dirname "$file")"
    
    if [ "$SOURCE_TYPE" = "github" ]; then
        # GitHub Raw Content
        URL="https://raw.githubusercontent.com/$SOURCE_ORG/$SOURCE_REPO/$SOURCE_BRANCH/$file"
        HTTP_CODE=$(curl -sL -w "%{http_code}" "$URL" -o "$file")
    elif [ "$SOURCE_TYPE" = "azure-repos" ]; then
        # Azure DevOps REST API
        # Note: This assumes the user has set up authentication if needed,
        # or uses public access if available.
        if [ -z "$SOURCE_PROJECT" ]; then
            echo "  ✗ Error: source.project is required for azure-repos"
            exit 1
        fi
        
        API_URL="https://dev.azure.com/$SOURCE_ORG/$SOURCE_PROJECT/_apis/git/repositories/$SOURCE_REPO/items"
        API_URL="$API_URL?path=/$file&versionType=branch&version=$SOURCE_BRANCH&api-version=7.0"
        
        # If AZURE_PERSONAL_ACCESS_TOKEN is set, use it
        if [ -n "$AZURE_PERSONAL_ACCESS_TOKEN" ]; then
            HTTP_CODE=$(curl -sL -w "%{http_code}" -u ":$AZURE_PERSONAL_ACCESS_TOKEN" "$API_URL" -o "$file")
        else
            HTTP_CODE=$(curl -sL -w "%{http_code}" "$API_URL" -o "$file")
        fi
    else
        echo "  ✗ Error: Unknown source type: $SOURCE_TYPE"
        exit 1
    fi

    if [ "$HTTP_CODE" = "200" ]; then
        echo "  ✓ Downloaded successfully"
    else
        echo "  ✗ Failed (HTTP $HTTP_CODE)"
        exit 1
    fi
done

echo ""
echo "✓ All files synced successfully"
