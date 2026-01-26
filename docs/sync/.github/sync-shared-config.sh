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

FILE_COUNT=0
# Calculate file count manually using jq lengths
INST_COUNT=$(jq '.instructions | length // 0' "$CONFIG_FILE")
PROM_COUNT=$(jq '.prompts | length // 0' "$CONFIG_FILE")
AGEN_COUNT=$(jq '.agents | length // 0' "$CONFIG_FILE")
COLL_COUNT=$(jq '.collections | length // 0' "$CONFIG_FILE")
FILE_COUNT_LEGACY=$(jq '.files | length // 0' "$CONFIG_FILE")
FILE_COUNT=$((INST_COUNT + PROM_COUNT + AGEN_COUNT + COLL_COUNT + FILE_COUNT_LEGACY))

echo "Items to sync: $FILE_COUNT"
echo ""

# Helper function to download a file from GitHub
download_file_github() {
    local source=$1
    local dest=$2
    
    mkdir -p "$(dirname "$dest")"
    
    if [ -n "$GITHUB_TOKEN" ]; then
        # Use GitHub API for private repos when token is provided
        local api_url="https://api.github.com/repos/$SOURCE_ORG/$SOURCE_REPO/contents/$source?ref=$SOURCE_BRANCH"
        echo "  Using GitHub API to download private file: $source"
        HTTP_CODE=$(curl -sL -w "%{http_code}" \
            -H "Authorization: Bearer $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github.v3.raw" \
            "$api_url" -o "$dest")
    else
        # Use raw.githubusercontent.com for public repos (no token needed)
        local url="https://raw.githubusercontent.com/$SOURCE_ORG/$SOURCE_REPO/$SOURCE_BRANCH/$source"
        echo "  Downloading public file: $source"
        HTTP_CODE=$(curl -sL -w "%{http_code}" "$url" -o "$dest")
    fi
    
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

# Helper function to sync a single file
sync_file() {
    local source=$1
    local dest=$2
    
    if [ "$SOURCE_TYPE" = "github" ]; then
        download_file_github "$source" "$dest"
    elif [ "$SOURCE_TYPE" = "azure-repos" ]; then
        download_file_azure "$source" "$dest"
    fi
}

# Helper function to sync items from a collection
sync_collection_items() {
    local collection_id=$1
    if [[ "$collection_id" == *".collection.yml" ]]; then
        collection_file="$collection_id"
    else
        collection_file="$collection_id.collection.yml"
    fi
    
    local source_path="collections/$collection_file"
    local temp_yaml=$(mktemp)
    
    echo "→ Fetching collection definition: $collection_file"
    if sync_file "$source_path" "$temp_yaml"; then
        # Parse items from YAML using sed/grep (basic parsing for "- path: ...")
        # We look for the items: section and then extract paths
        local item_paths=$(sed -n '/^items:/,/^[^ ]/p' "$temp_yaml" | grep '^[[:space:]]*- path:' | sed 's/^[[:space:]]*- path:[[:space:]]*//' | sed "s/['\"]//g")
        
        for path in $item_paths; do
            echo "  → From collection: $path"
            
            if [ "$(basename "$PWD")" = ".github" ]; then
                dest_path="$path"
            else
                dest_path="$TARGET_DIR/$path"
            fi
            
            sync_file "$path" "$dest_path"
        done
    fi
    rm -f "$temp_yaml"
}

# Process categorical files
sync_category() {
    local category=$1
    local extension=$2
    local items=$(jq -r ".${category}[] // empty" "$CONFIG_FILE")
    
    for item in $items; do
        if [ "$category" = "collections" ]; then
            sync_collection_items "$item"
            continue
        fi

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
        
        sync_file "$source_file" "$dest_file"
    done
}

# Sync all categories
sync_category "instructions" "instructions"
sync_category "prompts" "prompt"
sync_category "agents" "agent"
sync_category "collections" "collection"

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
    
    sync_file "$source_file" "$dest_file"
done

echo ""
echo "✓ All files synced successfully"
