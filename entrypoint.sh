#!/bin/bash
set -e

# ------------------------------
# GitHub CLI login using PAT
# ------------------------------
if [ -z "$GITHUB_PAT" ]; then
    echo "❌ GITHUB_PAT is not set!"
    exit 1
fi

echo "$GITHUB_PAT" | gh auth login --with-token

# ------------------------------
# Set Git credentials for cloning via HTTPS
# ------------------------------
git config --global url."https://$GITHUB_PAT:@github.com/".insteadOf "https://github.com/"

# ------------------------------
# Install gh-actions-importer extension
# ------------------------------
if ! gh extension list | grep -q "gh-actions-importer"; then
    echo "👉 Installing gh-actions-importer extension..."
    
    # Clone the actions-importer repo temporarily
    git clone https://github.com/github/gh-actions-importer.git /tmp/actions-importer
    
    # Install as a local GH CLI extension with 'gh-' prefix
    # gh extension install /tmp/actions-importer --force --name gh-actions-importer
    gh extension install github/gh-actions-importer --force


fi

# ------------------------------
# Optionally run migration script automatically
# ------------------------------
# ./scripts/Migrate_Yaml_Pipeline_v01.ps1  (uncomment if needed)

# ------------------------------
# Start Node.js MCP server
# ------------------------------
exec node server.js
