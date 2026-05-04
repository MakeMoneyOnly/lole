#!/usr/bin/env tsx
/**
 * CI Check: Detect migration timestamp conflicts
 *
 * Ensures no two migration files share the same timestamp prefix.
 * This prevents undefined execution order in Supabase migrations.
 *
 * Exit codes:
 *   0 - No conflicts
 *   1 - Conflicts found
 *
 * @see PRE-PRODUCTION-REMEDIATION-TASKS.md HIGH-004
 */

import { readdirSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

// Expected naming: YYYYMMDD_HHMMSS_category_description.sql
// or legacy: YYYYMMDD_description.sql
const NAMING_PATTERN = /^(\d{8}|\d{14})_[a-z0-9_]+\.sql$/;
const RECOMMENDED_CATEGORIES = [
    'schema',
    'rls',
    'index',
    'fix',
    'data',
    'cleanup',
    'p0',
    'p1',
    'p2',
];

interface Conflict {
    prefix: string;
    files: string[];
}

interface NamingIssue {
    file: string;
    reason: string;
}

function extractTimestamp(filename: string): string | null {
    const match = filename.match(/^(\d{8,14})/);
    return match ? match[1] : null;
}

function checkMigrationConflicts(): Conflict[] {
    const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql'));

    const prefixMap = new Map<string, string[]>();

    for (const file of files) {
        const prefix = extractTimestamp(file);
        if (!prefix) continue;

        const datePrefix = prefix.slice(0, 8);

        if (!prefixMap.has(datePrefix)) {
            prefixMap.set(datePrefix, []);
        }
        prefixMap.get(datePrefix)!.push(file);
    }

    const conflicts: Conflict[] = [];

    for (const [prefix, files] of prefixMap) {
        if (files.length > 1) {
            const fullTimestamps = new Set(files.map(f => extractTimestamp(f)));
            if (fullTimestamps.size < files.length) {
                conflicts.push({ prefix, files });
            }
        }
    }

    return conflicts;
}

function checkNamingConventions(): NamingIssue[] {
    const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql') && f !== 'README.md');
    const issues: NamingIssue[] = [];

    for (const file of files) {
        if (!NAMING_PATTERN.test(file)) {
            issues.push({
                file,
                reason: 'does not match pattern YYYYMMDD[_HHMMSS]_description.sql',
            });
        }
    }

    return issues;
}

const conflicts = checkMigrationConflicts();
const namingIssues = checkNamingConventions();

let hasErrors = false;

if (conflicts.length === 0) {
    process.stdout.write('✅ No migration timestamp conflicts found\n');
} else {
    hasErrors = true;
    console.error('❌ Migration timestamp conflicts detected:\n');

    for (const conflict of conflicts) {
        console.error(`  Prefix ${conflict.prefix}:`);
        for (const file of conflict.files) {
            console.error(`    - ${file}`);
        }
        console.error('');
    }

    console.error('Fix by renaming files to have unique timestamps.');
    console.error('Example: 20260324000000_file.sql → 20260324000001_file.sql');
}

if (namingIssues.length > 0) {
    process.stdout.write(`\n⚠️  Migration naming warnings (${namingIssues.length}):\n`);
    for (const issue of namingIssues) {
        process.stdout.write(`  - ${issue.file}: ${issue.reason}\n`);
    }
    process.stdout.write('Expected: YYYYMMDD_HHMMSS_category_description.sql\n');
    process.stdout.write(`Recommended categories: ${RECOMMENDED_CATEGORIES.join(', ')}\n`);
} else {
    process.stdout.write('✅ All migrations follow naming conventions\n');
}

process.exit(hasErrors ? 1 : 0);
