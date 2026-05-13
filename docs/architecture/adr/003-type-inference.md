# ADR-003: Database Type Inference

**Status:** Accepted  
**Date:** 2026-05-13  
**Deciders:** Architecture Review

## Context

Database types were manually defined in multiple locations, leading to drift and type safety issues.

## Decision

Generate types from Supabase database schema using `supabase gen types`:

```bash
supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
```

Use generated types for all database operations:

```typescript
import { Database } from '@/types/database';

type Staff = Database['public']['Tables']['staff']['Row'];
type StaffInsert = Database['public']['Tables']['staff']['Insert'];
type StaffUpdate = Database['public']['Tables']['staff']['Update'];
```

## Enforcement

- ESLint rule to prevent manual type definitions for database tables
- Pre-commit hook ensures types are regenerated after schema changes
