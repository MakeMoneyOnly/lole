#!/usr/bin/env bash
# Pre-commit hook to validate migrations
# Install: cp scripts/pre-commit-migration-check.sh .git/hooks/pre-commit

set -e

echo "=== Checking migration files ==="

# Get list of staged migration files
STAGED_MIGRATIONS=$(git diff --cached --name-only --diff-filter=ACM "supabase/migrations/*.sql" 2>/dev/null || true)

if [ -z "$STAGED_MIGRATIONS" ]; then
    echo "No migration files staged."
    exit 0
fi

# Validate each migration file
for file in $STAGED_MIGRATIONS; do
    filename=$(basename "$file")
    
    # Check naming convention
    if [[ ! "$filename" =~ ^[0-9]{8,14}_[a-z0-9_]+\.sql$ ]]; then
        echo "ERROR: Invalid migration filename: $filename"
        echo "Expected format: YYYYMMDDHHMMSS_description.sql"
        exit 1
    fi
    
    # Check for BEGIN/COMMIT
    if ! grep -q "BEGIN;" "$file" || ! grep -q "COMMIT;" "$file"; then
        echo "WARNING: Migration $filename missing BEGIN/COMMIT transaction block"
    fi
    
    # Check for dangerous operations
    if grep -qE "DROP TABLE|TRUNCATE|DELETE FROM" "$file"; then
        echo "WARNING: Migration $filename contains potentially dangerous operations"
        echo "Please review carefully before committing."
    fi
    
    echo "OK: $filename"
done

echo "=== Migration validation passed ==="
