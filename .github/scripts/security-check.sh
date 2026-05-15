#!/bin/bash

# Security Checklist CI Script
# Runs security checks on codebase and outputs warnings/errors

ERRORS=0
WARNINGS=0

echo "================================"
echo "Security Checklist"
echo "================================"

# 1. Check for hardcoded secrets (API keys, passwords)
echo ""
echo "[1] Checking for hardcoded secrets..."
if grep -rE "(apiKey|api_key|secret|password|token)[[:space:]]*[=:][[:space:]]*['\"][A-Za-z0-9+/=]{20,}['\"]" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next 2>/dev/null; then
    echo "ERROR: Found potential hardcoded secrets in code"
    ERRORS=$((ERRORS + 1))
else
    echo "  [OK] No hardcoded secrets found"
fi

# 2. Check for SQL injection patterns (string concatenation in queries)
echo ""
echo "[2] Checking for SQL injection patterns..."
if grep -rE "(SELECT|INSERT|UPDATE|DELETE).*\+.*['\"]" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next 2>/dev/null | grep -v '\.col/'; then
    echo "WARNING: Found potential SQL injection patterns (string concatenation in queries)"
    WARNINGS=$((WARNINGS + 1))
else
    echo "  [OK] No SQL injection patterns found"
fi

# 3. Check for exposed process.env usage (SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY)
echo ""
echo "[3] Checking for exposed sensitive env vars..."
SENSITIVE_VARS=$(grep -rE "process\.env\.(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY)" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next 2>/dev/null || true)
if [ -n "$SENSITIVE_VARS" ]; then
    echo "ERROR: Found exposed sensitive environment variables:"
    echo "$SENSITIVE_VARS"
    ERRORS=$((ERRORS + 1))
else
    echo "  [OK] No sensitive env vars exposed"
fi

# 4. Ensure .env files are not tracked (except .env.example files which are intentional)
echo ""
echo "[4] Checking .env files are not tracked..."
if [ -f .gitignore ]; then
    if grep -q "^\.env" .gitignore; then
        echo "  [OK] .env files are ignored in .gitignore"
    else
        echo "WARNING: .env files may not be properly ignored"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "ERROR: .gitignore file not found"
    ERRORS=$((ERRORS + 1))
fi

# Check for tracked .env files (excluding .env.example and .env.*.example which are intentional)
TRACKED_ENV=$(git ls-files --error-unmatch .env* 2>/dev/null | grep -v -E '\.env(\..+)?\.example$' || true)
if [ -n "$TRACKED_ENV" ]; then
    echo "ERROR: .env files are tracked in git:"
    echo "$TRACKED_ENV"
    ERRORS=$((ERRORS + 1))
fi

# Summary
echo ""
echo "================================"
echo "Summary"
echo "================================"
echo "Errors: $ERRORS"
echo "Warnings: $WARNINGS"

if [ $ERRORS -gt 0 ]; then
    echo ""
    echo "SECURITY CHECK FAILED"
    exit 1
fi

echo ""
echo "SECURITY CHECK PASSED"
exit 0