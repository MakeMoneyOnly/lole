# Dependency Management Guide

## Overview

This document outlines lole Restaurant OS's enterprise-grade approach to managing npm dependencies, with a focus on security, reliability, and maintainability.

## Table of Contents

1. [Philosophy](#philosophy)
2. [Configuration](#configuration)
3. [Handling Deprecated Dependencies](#handling-deprecated-dependencies)
4. [Handling Vulnerable Dependencies](#handling-vulnerable-dependencies)
5. [Overrides Management](#overrides-management)
6. [CI/CD Integration](#cicd-integration)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Philosophy

### Core Principles

1. **Security First**: All dependencies must be audited for security vulnerabilities
2. **Explicit Over Implicit**: Declare all dependencies explicitly; avoid phantom dependencies
3. **Minimal Attack Surface**: Reduce the number of dependencies and their attack vectors
4. **Reproducible Builds**: Lockfiles ensure consistent installations across environments
5. **Proactive Maintenance**: Regular updates and deprecation checks

### Why This Matters

- **Supply Chain Attacks**: npm supply chain attacks tripled from 2022-2025
- **Transitive Dependencies**: Most vulnerabilities come from indirect dependencies
- **Deprecated Packages**: May contain unfixed security issues or breaking changes

---

## Configuration

### `.npmrc` Settings

Our `.npmrc` implements strict security defaults:

```ini
# Strict dependency resolution (no phantom dependencies)
hoist=false
shamefully-hoist=false

# Enforce strict peer dependencies
strict-peer-dependencies=true

# Block exotic sources (git repos, tarballs) for transitive deps
block-exotic-subdeps=true

# Minimum release age (24 hours) - malware protection
minimum-release-age=1440

# Trust policy: prevent downgrades in trust level
trust-policy=no-downgrade

# Node.js version enforcement
engine-strict=true
```

### `package.json` Structure

```json
{
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "pnpm": {
    "overrides": { ... },
    "allowBuilds": [ ... ],
    "auditConfig": {
      "ignoreGhsas": []
    }
  }
}
```

---

## Handling Deprecated Dependencies

### Detection

Run the deprecation checker:

```bash
pnpm security:deprecated
```

This script:

1. Checks `package.json` for known deprecated packages
2. Scans the dependency tree for deprecated transitive dependencies
3. Reports findings with remediation suggestions

### Remediation Steps

#### For Direct Dependencies

1. **Update to a non-deprecated version**:

    ```bash
    pnpm update <package-name>
    ```

2. **Find a replacement** if the package is fully deprecated:
    ```bash
    # Example: replacing deprecated 'request' with 'axios'
    pnpm remove request
    pnpm add axios
    ```

#### For Transitive Dependencies

1. **Check which package depends on it**:

    ```bash
    pnpm why <package-name>
    ```

2. **Update the parent package** if possible:

    ```bash
    pnpm update <parent-package>
    ```

3. **Add an override** if the parent package won't update:
    ```json
    {
        "pnpm": {
            "overrides": {
                "deprecated-package": "^replacement-version"
            }
        }
    }
    ```

---

## Handling Vulnerable Dependencies

### Detection

Run security audit:

```bash
pnpm security:audit
```

### Severity Levels

| Level    | Action Required                     |
| -------- | ----------------------------------- |
| Critical | Fix immediately; block deployment   |
| High     | Fix within 24 hours; warn in CI     |
| Moderate | Fix within 1 week; track in backlog |
| Low      | Fix during regular maintenance      |

### Remediation Steps

1. **Try automatic fix**:

    ```bash
    pnpm security:audit:fix
    ```

2. **Update the vulnerable package**:

    ```bash
    pnpm update <package-name>
    ```

3. **For transitive vulnerabilities**, add an override:

    ```json
    {
        "pnpm": {
            "overrides": {
                "vulnerable-package@<vulnerable-range>": "^patched-version"
            }
        }
    }
    ```

4. **Verify the fix**:
    ```bash
    pnpm audit
    ```

### Example: Fixing a Transitive Vulnerability

```bash
# 1. Identify the vulnerability
$ pnpm audit
┌─────────────────┬────────────────────────────────┐
│ high            │ flatted vulnerable to DoS      │
├─────────────────┼────────────────────────────────┤
│ Package         │ flatted                        │
├─────────────────┼────────────────────────────────┤
│ Vulnerable      │ <3.4.0                         │
├─────────────────┼────────────────────────────────┤
│ Patched         │ >=3.4.0                        │
├─────────────────┼────────────────────────────────┤
│ Path            │ eslint>file-entry-cache>...    │
└─────────────────┴────────────────────────────────┘

# 2. Add override to package.json
{
  "pnpm": {
    "overrides": {
      "flatted@<3.4.0": "^3.4.0"
    }
  }
}

# 3. Reinstall and verify
$ pnpm install
$ pnpm audit
```

---

## Overrides Management

### When to Use Overrides

1. **Security patches** for vulnerable transitive dependencies
2. **Compatibility fixes** for breaking changes in transitive deps
3. **Fork replacements** for unmaintained packages

### Override Syntax

```json
{
    "pnpm": {
        "overrides": {
            // Simple: all versions of 'package'
            "package-name": "^2.0.0",

            // Version-specific: only vulnerable versions
            "package-name@<1.0.0": "^1.0.0",
            "package-name@>=2.0.0 <2.5.0": "^2.5.0",

            // Scoped packages
            "@scope/package": "^3.0.0"
        }
    }
}
```

### Checking for Unused Overrides

```bash
pnpm security:overrides:check
```

This identifies overrides that no longer apply to any installed package.

### Override Maintenance

1. **Document each override** with a comment explaining why it exists
2. **Review overrides quarterly** or when updating major dependencies
3. **Remove unused overrides** to keep `package.json` clean

---

## CI/CD Integration

### Automated Checks

Our CI pipeline includes:

1. **Security Audit** (`pnpm audit --audit-level=high`)
    - Runs on every PR and push
    - Fails on high/critical vulnerabilities

2. **Dependency Review** (GitHub Actions)
    - Reviews new dependencies in PRs
    - Checks license compliance
    - Identifies known vulnerabilities

3. **Deprecated Check** (custom script)
    - Scans for deprecated packages
    - Reports warnings in CI output

4. **Weekly Outdated Check**
    - Creates GitHub issue with outdated packages
    - Runs every Monday at 6:00 AM UTC

### Workflow Files

- `.github/workflows/ci.yml` - Main CI pipeline
- `.github/workflows/dependency-review.yml` - Dependency security checks

### Running Locally

```bash
# Full security check
pnpm security:audit

# Check for deprecated packages
pnpm security:deprecated

# Check for unused overrides
pnpm security:overrides:check

# Check for outdated packages
pnpm security:outdated

# Update dependencies interactively
pnpm deps:update

# Clean pnpm store
pnpm deps:clean
```

---

## Best Practices

### Adding New Dependencies

1. **Research the package**:
    - Check maintenance status
    - Review security history
    - Verify license compatibility

2. **Install with version pinning**:

    ```bash
    pnpm add package@^1.2.3
    ```

3. **Verify installation**:
    ```bash
    pnpm why package
    pnpm audit
    ```

### Updating Dependencies

1. **Regular updates** (weekly/bi-weekly):

    ```bash
    pnpm deps:update
    ```

2. **Major version updates**:
    - Review changelog for breaking changes
    - Update in a separate branch
    - Run full test suite

3. **Security updates**:
    - Prioritize over feature work
    - Apply immediately for critical/high severity

### Dependency Audit Checklist

- [ ] No deprecated packages in direct dependencies
- [ ] No high/critical vulnerabilities
- [ ] All overrides are documented
- [ ] Lockfile committed to repository
- [ ] CI security checks passing

---

## Troubleshooting

### Common Issues

#### "Cannot find module" errors after install

This is likely due to strict hoisting. Solutions:

1. Add the missing package to your `package.json`
2. Check if a peer dependency is missing
3. Review `.npmrc` settings

#### Override not applying

1. Check the override syntax matches the package name exactly
2. Verify the version range in the override key
3. Run `pnpm install` to apply changes

#### Build scripts failing

pnpm v10+ blocks postinstall scripts by default. To allow:

```json
{
    "pnpm": {
        "allowBuilds": ["package-that-needs-build-script"]
    }
}
```

#### Peer dependency warnings

1. Install missing peers explicitly:

    ```bash
    pnpm add peer-package
    ```

2. Or disable strict mode temporarily (not recommended):
    ```ini
    # .npmrc
    strict-peer-dependencies=false
    ```

### Getting Help

1. Check pnpm documentation: https://pnpm.io/
2. Review GitHub Issues for known problems
3. Contact the team in #engineering Slack channel

---

## Appendix: Security Tools Reference

| Tool                         | Purpose                     | Command                         |
| ---------------------------- | --------------------------- | ------------------------------- |
| `pnpm audit`                 | Security vulnerability scan | `pnpm security:audit`           |
| `pnpm outdated`              | Check for updates           | `pnpm security:outdated`        |
| `check-deprecated.mjs`       | Find deprecated packages    | `pnpm security:deprecated`      |
| `check-unused-overrides.mjs` | Find unused overrides       | `pnpm security:overrides:check` |
| Trivy                        | Container/filesystem scan   | CI automated                    |
| Dependency Review Action     | PR dependency check         | CI automated                    |

---

_Last updated: March 2026_
_Document owner: Engineering Team_
