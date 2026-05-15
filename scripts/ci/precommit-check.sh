#!/bin/bash
set -e

echo "🚀 Running enterprise-grade pre-commit checks..."

# Check for any types in production code
echo "🔍 Checking for 'any' types..."
ANY_FILES=$(git diff --cached --name-only --diff-filter=ACM 'src/**/*.ts' 'src/**/*.tsx' 2>/dev/null | grep -v '.test.' | grep -v '__tests__' | xargs grep -l ': any' 2>/dev/null || true)
if [ -n "$ANY_FILES" ]; then
  echo "❌ Error: Found 'any' type in production code:"
  echo "$ANY_FILES"
  echo ""
  echo "Use proper types instead. See AGENTS.md Code Quality Standards."
  exit 1
fi

# Check for console.log in production code
echo "🔍 Checking for console.log..."
CONSOLE_FILES=$(git diff --cached --name-only --diff-filter=ACM 'src/**/*.ts' 'src/**/*.tsx' 2>/dev/null | grep -v '.test.' | grep -v '__tests__' | xargs grep -l 'console\.\(log\|info\|debug\|table\)' 2>/dev/null || true)
if [ -n "$CONSOLE_FILES" ]; then
  echo "⚠️  Warning: Found console statements in:"
  echo "$CONSOLE_FILES"
  echo ""
  echo "Use src/lib/logger.ts instead. See AGENTS.md Code Quality Standards."
fi

# Check for img elements
echo "🔍 Checking for <img> elements..."
IMG_FILES=$(git diff --cached --name-only --diff-filter=ACM 'src/**/*.tsx' 2>/dev/null | xargs grep -l '<img' 2>/dev/null || true)
if [ -n "$IMG_FILES" ]; then
  echo "⚠️  Warning: Found <img> elements in:"
  echo "$IMG_FILES"
  echo ""
  echo "Use Next.js <Image /> component instead. See AGENTS.md Code Quality Standards."
fi

echo "✅ Pre-commit checks passed!"
