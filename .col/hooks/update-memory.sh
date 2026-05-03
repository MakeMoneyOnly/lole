#!/bin/bash
# Cognitive Orchestration Layer - Memory Update Hook
# Runs after successful deployment to update PGMS

set -euo pipefail

COL_DIR=".col"
MEMORY_FILE="$COL_DIR/memory/living-blueprint.md"
BLUEPRINT_BACKUP="$COL_DIR/memory/living-blueprint.md.bak"

# Backup current blueprint
if [ -f "$MEMORY_FILE" ]; then
    cp "$MEMORY_FILE" "$BLUEPRINT_BACKUP"
fi

# Get current git info
COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
COMMIT_DATE=$(git show -s --format=%ci HEAD 2>/dev/null || date -Iseconds)

# Update Implementation Ledger
echo "Updating implementation ledger..."

# Append to decision log
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Read current content
CURRENT_CONTENT=$(cat "$MEMORY_FILE" 2>/dev/null || echo "")

# Check if file exists and update it
if [ -f "$MEMORY_FILE" ]; then
    # Update the last updated timestamp in the metadata
    sed -i "s/Last Updated:.*/Last Updated: $TIMESTAMP/" "$MEMORY_FILE" 2>/dev/null || true
    
    # Add new entry to Skill Integration Milestones
    sed -i "/## Skill Integration Milestones/a | $TIMESTAMP | Deployment completed | $COMMIT_HASH |" "$MEMORY_FILE" 2>/dev/null || true
fi

echo "Memory updated: $TIMESTAMP (commit: $COMMIT_HASH)"