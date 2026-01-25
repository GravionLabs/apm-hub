#!/bin/bash

# Shared Configuration Sync Script (Shell)
# Synchronizes shared .github configuration files from a central repository.

set -e

# Try to find the config file in the current directory or .github/
if [ -f "sync-config.json" ]; then
    CONFIG_FILE="sync-config.json"
elif [ -f ".github/sync-config.json" ]; then
    CONFIG_FILE=".github/sync-config.json"
else
    echo "Error: Sync configuration file (sync-config.json or .github/sync-config.json) not found."
    exit 1
fi

echo "Reading configuration from $CONFIG_FILE..."

SOURCE_TYPE=$(jq -r '.syncSettings.type' "$CONFIG_FILE")
SOURCE_ORG=$(jq -r '.syncSettings.org' "$CONFIG_FILE")
SOURCE_REPO=$(jq -r '.syncSettings.repo' "$CONFIG_FILE")
SOURCE_BRANCH=$(jq -r '.syncSettings.branch' "$CONFIG_FILE")
SOURCE_PROJECT=$(jq -r '.syncSettings.project // empty' "$CONFIG_FILE")
SOURCE_DIR=$(jq -r '.syncSettings.sourceDir // "templates"' "$CONFIG_FILE")
TARGET_DIR=$(jq -r '.syncSettings.targetDir // ".github"' "$CONFIG_FILE")

echo "Source: $SOURCE_TYPE"
echo "Organization: $SOURCE_ORG"
echo "Repository: $SOURCE_REPO"
echo "Branch: $SOURCE_BRANCH"
echo "Source Directory: $SOURCE_DIR"
echo "Target Directory: $TARGET_DIR"

FILE_COUNT=$(jq '.files | length' "$CONFIG_FILE")
echo "Files to sync: $FILE_COUNT"
echo ""

# Helper function to download a file from GitHub
download_file_github() {
    local source=$1
    local dest=$2
    local url="https://raw.githubusercontent.com/$SOURCE_ORG/$SOURCE_REPO/$SOURCE_BRANCH/$source"
    
    mkdir -p "$(dirname "$dest")"
    HTTP_CODE=$(curl -sL -w "%{http_code}" "$url" -o "$dest")
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "  ✓ Downloaded: $dest"
        return 0
    else
        echo "  ✗ Failed (HTTP $HTTP_CODE): $dest"
        return 1
    fi
}

# Helper function to download a file from Azure DevOps
download_file_azure() {
    local source=$1
    local dest=$2
    
    if [ -z "$SOURCE_PROJECT" ]; then
        echo "  ✗ Error: source.project is required for azure-repos"
        return 1
    fi
    
    local api_url="https://dev.azure.com/$SOURCE_ORG/$SOURCE_PROJECT/_apis/git/repositories/$SOURCE_REPO/items"
    api_url="$api_url?path=/$source&versionType=branch&version=$SOURCE_BRANCH&api-version=7.0"
    
    mkdir -p "$(dirname "$dest")"
    
    if [ -n "$AZURE_PERSONAL_ACCESS_TOKEN" ]; then
        HTTP_CODE=$(curl -sL -w "%{http_code}" -u ":$AZURE_PERSONAL_ACCESS_TOKEN" "$api_url" -o "$dest")
    else
        HTTP_CODE=$(curl -sL -w "%{http_code}" "$api_url" -o "$dest")
    fi
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "  ✓ Downloaded: $dest"
        return 0
    else
        echo "  ✗ Failed (HTTP $HTTP_CODE): $dest"
        return 1
    fi
}

# Process categorical files
sync_category() {
    local category=$1
    local extension=$2
    local items=$(jq -r ".${category}[] // empty" "$CONFIG_FILE")
    
    for item in $items; do
        # Check if item already has the full name/extension
        if [[ "$item" == *".$extension.md" ]]; then
            filename="$item"
        else
            filename="$item.$extension.md"
        fi
        
        # If we are in the .github directory, the target is the current directory
        if [ "$(basename "$PWD")" = ".github" ]; then
            dest_file="$category/$filename"
        else
            dest_file="$TARGET_DIR/$category/$filename"
        fi
        
        source_file="$SOURCE_DIR/$category/$filename"
        
        echo "→ Syncing $category: $filename"
        
        if [ "$SOURCE_TYPE" = "github" ]; then
            download_file_github "$source_file" "$dest_file"
        elif [ "$SOURCE_TYPE" = "azure-repos" ]; then
            download_file_azure "$source_file" "$dest_file"
        fi
    done
}

# Sync all categories
sync_category "instructions" "instructions"
sync_category "prompts" "prompt"
sync_category "agents" "agent"

# Keep support for legacy "files" array if needed, but categorical is preferred
LEGACY_FILES=$(jq -r '.files[] // empty' "$CONFIG_FILE")
for file in $LEGACY_FILES; do
    # If we are in the .github directory, the target is the current directory
    if [ "$(basename "$PWD")" = ".github" ]; then
        dest_file="$file"
    else
        dest_file="$TARGET_DIR/$file"
    fi
    
    source_file="$SOURCE_DIR/$file"
    
    echo "→ Syncing legacy file: $file"
    
    if [ "$SOURCE_TYPE" = "github" ]; then
        download_file_github "$source_file" "$dest_file"
    elif [ "$SOURCE_TYPE" = "azure-repos" ]; then
        download_file_azure "$source_file" "$dest_file"
    fi
done

echo ""
echo "✓ All files synced successfully"
