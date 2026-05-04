#!/bin/bash
# Pre-commit hook: Secret scanning
# SEC-006: Blocks accidental commits of secrets, .env files, and unsecured credentials.

set -e

STAGED_FILES=$(git diff --cached --name-only 2>/dev/null || true)

if [ -z "$STAGED_FILES" ]; then
    exit 0
fi

# Block .env files (allow only .env.example and .env.local.example)
ENV_FILES=$(echo "$STAGED_FILES" | grep -E '\.env' | grep -v '\.env\.example$' | grep -v '\.env\.local\.example$' || true)
if [ -n "$ENV_FILES" ]; then
    echo "========================================"
    echo "ERROR: .env files detected in staging"
    echo "$ENV_FILES"
    echo ""
    echo ".env files must NOT be committed."
    echo "Allowed: .env.example, .env.local.example"
    echo "========================================"
    exit 1
fi

# Check for common secret patterns in staged changes
SECRET_PATTERNS=(
    'SUPABASE_SECRET_KEY\s*=\s*[a-zA-Z0-9_-]{20,}'
    'SUPABASE_SERVICE_ROLE_KEY\s*=\s*[a-zA-Z0-9_-]{20,}'
    'CHAPA_SECRET_KEY\s*=\s*[A-Z]{4,}'
    'QSTASH_TOKEN\s*=\s*[a-zA-Z0-9_-]{20,}'
    'RESEND_API_KEY\s*=\s*re_[a-zA-Z0-9]+'
    'sk-[a-zA-Z0-9]{20,}'
    '-----BEGIN (RSA|OPENSSH|EC) PRIVATE KEY-----'
)

for file in $STAGED_FILES; do
    if [ -f "$file" ] && echo "$file" | grep -qvE '(\.example$|\.md$|\.test\.ts$|\.spec\.ts$|__tests__/)'; then
        DIFF=$(git diff --cached "$file" 2>/dev/null || true)
        for pattern in "${SECRET_PATTERNS[@]}"; do
            if echo "$DIFF" | grep -Eq "$pattern"; then
                echo "========================================"
                echo "ERROR: Potential secret detected in $file"
                echo "Pattern: $pattern"
                echo "========================================"
                exit 1
            fi
        done
    fi
done

echo "[pre-commit] Secret scan passed"
exit 0
