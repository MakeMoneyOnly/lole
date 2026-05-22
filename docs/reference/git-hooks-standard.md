# Git Hooks Standard - SEC-GIT-001

This document describes the standardized git hook setup for the Lole Menu repository.

## Hook Chain Overview

### Pre-commit Hook (`.husky/pre-commit`)

Runs locally before each commit to ensure code quality and security:

1. **Gitignored Files Check** - Blocks commits with staged gitignored files
2. **Secret Detection** - Runs `ggshield` and `trivy` via `scripts/security/precommit-security.mjs`
3. **Lint-Staged** - Lints and formats staged `.ts`, `.tsx`, `.json`, `.md`, `.css` files
4. **Migration FK Check** - Warns if migrations reference `auth.users` without `ON DELETE` clause
5. **Type Check** - Runs `pnpm type-check` to verify TypeScript compilation

### Pre-push Hook (`.husky/pre-push`)

Runs before pushing to remote to catch bypassed commits:

1. **--no-verify Detection** - Blocks pushes if `hooks.pre-push.requireVerification` is enabled
2. **GitGuardian Pre-push Scan** - Scans ALL commits being pushed for secrets
3. **Gitignored Files Check** - Final verification no gitignored files are tracked

## Hook Enforcement (`scripts/security/enforce-hooks.mjs`)

The `enforce-hooks.mjs` script runs post-install to make local bypass inconvenient:

- Sets `core.hooksPath = .husky` to ensure hooks are always used
- Creates `alias.push = push --verify` to prevent `git push --no-verify`
- Runs automatically via `pnpm prepare` postinstall hook

## Setup Instructions

### Prerequisites

Install required tools:

```bash
# GitGuardian (secret scanning)
pip install --user ggshield

# Trivy (vulnerability scanning - Windows)
winget install -e --id AquaSecurity.Trivy

# Trivy (macOS)
brew install aquasecurity/trivy/trivy

# Trivy (Linux)
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sudo sh -s -- -b /usr/local/bin
```

### Initial Setup

```bash
# Clone and install dependencies
git clone <repo-url>
cd lole-menu
pnpm install

# Verify hooks are installed
ls -la .husky/
# Should show: pre-commit, pre-push, and the _/ directory
```

### Team Member Verification

After cloning, verify hook configuration:

```bash
# Check hooks path is set
git config --local core.hooksPath
# Expected: .husky

# Check push alias
git config --get alias.push
# Expected: push --verify

# Test hook execution
git commit --allow-empty -m "test: verify hooks"
# Should see: "🔍 Running pre-commit checks..."
```

## Hook Bypass Prevention

### Local Layer

The pre-commit hook checks for gitignored files **first**, preventing the common technique of staging sensitive files and using `--no-verify`:

```bash
# This WILL be caught even with --no-verify
git add .env
git commit -m "bad commit" --no-verify  # Fails on gitignored file check
```

### Push Protection

The pre-push hook uses `requireVerification` flag:

```bash
# If CI sets this flag, --no-verify commits cannot be pushed
git config hooks.pre-push.requireVerification true
```

### Server-side Gate

CI is the real enforcement mechanism. Hooks provide defense-in-depth.

## Emergency Bypass

### Secret Scanning Only

```bash
GITGUARDIAN_SKIP=1 git commit -m "emergency commit"
```

Document the reason in commit body and notify security team.

### All Hooks

```bash
git commit -m "commit" --no-verify  # Local only - CI will reject
```

**Note:** `--no-verify` bypasses hooks locally. CI will catch issues on push.

## Troubleshooting

### "ggshield not installed"

```bash
pip install --user ggshield
# Restart terminal to refresh PATH
```

### "Trivy not installed" (Windows)

```bash
# If installed via winget, verify path
ls "$LOCALAPPDATA/Microsoft/WinGet/Packages/AquaSecurity.Trivy_Microsoft.Winget.Source_8wekyb3d8bbwe/trivy.exe"
```

### Hooks Not Running

```bash
# Re-run hook setup
pnpm prepare

# Verify hooks path
git config --local core.hooksPath

# Manual test
.git/hooks/pre-commit
```

### Trivy Timeout

Default timeout is 30 minutes. For slow connections, increase in `scripts/security/precommit-security.mjs`.

## Related Files

- `.husky/pre-commit` - Main pre-commit hook
- `.husky/pre-push` - Push-time security scan
- `scripts/security/precommit-security.mjs` - Secret and vulnerability scanning
- `scripts/security/enforce-hooks.mjs` - Hook configuration enforcement
