# ADR-002: Feature-Sliced Design

**Status:** Accepted  
**Date:** 2026-05-13  
**Deciders:** Architecture Review

## Context

The presentation layer needed organization that groups code by feature rather than by file type (components, hooks, styles separately).

## Decision

Adopt **feature-sliced design** where each feature contains all its related code:

```
features/
├── merchant/
│   ├── hooks/        # Feature-specific hooks
│   ├── components/   # UI components
│   └── utils/        # Feature utilities
└── kds/
    ├── hooks/
    ├── components/
    └── lib/
```

## Rules

1. **Feature-specific hooks** live in `features/[feature]/hooks/`
2. **Generic hooks** live in `hooks/` at root level
3. **Components** are colocated with their feature
4. **Utilities** specific to a feature stay with that feature

## Benefits

- Easier feature discovery
- Reduced cognitive load when working on a feature
- Simpler removal of deprecated features (delete folder)
