/**
 * Test Organization Orchestrator
 *
 * Coordinates test reorganization across features and domains.
 * Uses the orchestrator pattern to ensure consistent structure and dependency management.
 *
 * Target structure:
 *   feature/
 *     __tests__/
 *       unit/
 *       integration/
 *
 * @see docs/architecture/ENTERPRISE_ARCHITECTURE_TASKS.md - Task 7
 */

import { existsSync, mkdirSync, readdirSync, renameSync, statSync } from 'fs';
import { join, relative } from 'path';
import { logger } from '@/lib/logger';

const log = logger.child('architecture/test-orchestrator');

interface TestFile {
    currentPath: string;
    targetPath: string;
    type: 'unit' | 'integration';
    feature?: string;
    module?: string;
}

interface OrchestrationResult {
    moved: TestFile[];
    created: string[];
    alreadyOrganized: TestFile[];
}

class TestOrganizationOrchestrator {
    private readonly srcDir = 'src';
    private readonly featuresDir = join(this.srcDir, 'features');
    private readonly domainsDir = join(this.srcDir, 'domains');
    private readonly libDir = join(this.srcDir, 'lib');

    execute(): OrchestrationResult {
        const moves: TestFile[] = [];
        const created: string[] = [];
        const alreadyOrganized: TestFile[] = [];

        // Process all test locations
        this.processDirectory(this.featuresDir, moves, created, alreadyOrganized);
        this.processDirectory(this.domainsDir, moves, created, alreadyOrganized);
        this.processDirectory(this.libDir, moves, created, alreadyOrganized);

        // Execute moves
        for (const move of moves) {
            this.executeMove(move, created);
        }

        return { moved: moves, created, alreadyOrganized };
    }

    private processDirectory(
        baseDir: string,
        moves: TestFile[],
        created: string[],
        alreadyOrganized: TestFile[]
    ): void {
        if (!existsSync(baseDir)) return;

        this.walkDirectory(baseDir, currentDir => {
            const entries = readdirSync(currentDir);

            for (const entry of entries) {
                const fullPath = join(currentDir, entry);
                const stat = statSync(fullPath);

                if (stat.isDirectory() && entry === '__tests__') {
                    this.processTestsDir(fullPath, moves, created, alreadyOrganized);
                }
            }
        });
    }

    private walkDirectory(dir: string, callback: (dir: string) => void): void {
        callback(dir);
        const entries = readdirSync(dir);
        for (const entry of entries) {
            const fullPath = join(dir, entry);
            if (statSync(fullPath).isDirectory()) {
                this.walkDirectory(fullPath, callback);
            }
        }
    }

    private processTestsDir(
        testsDir: string,
        moves: TestFile[],
        created: string[],
        alreadyOrganized: TestFile[]
    ): void {
        // Skip if already has unit/integration structure
        if (existsSync(join(testsDir, 'unit')) || existsSync(join(testsDir, 'integration'))) {
            const entries = readdirSync(testsDir);
            for (const entry of entries) {
                if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) {
                    alreadyOrganized.push({
                        currentPath: join(testsDir, entry),
                        targetPath: join(testsDir, entry),
                        type: 'unit',
                    });
                }
            }
            return;
        }

        // Process test files in this __tests__ directory
        const entries = readdirSync(testsDir);
        for (const entry of entries) {
            const fullPath = join(testsDir, entry);

            if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) {
                const isIntegration = entry.includes('.integration.');
                const type = isIntegration ? 'integration' : 'unit';
                const targetPath = join(testsDir, type, entry);

                moves.push({
                    currentPath: fullPath,
                    targetPath,
                    type,
                });
            }
        }
    }

    private executeMove(test: TestFile, created: string[]): void {
        const targetDir = test.targetPath.substring(0, test.targetPath.lastIndexOf('/'));

        if (!existsSync(targetDir)) {
            mkdirSync(targetDir, { recursive: true });
            created.push(targetDir);
        }

        // Rename file atomically
        renameSync(test.currentPath, test.targetPath);
    }

    generateReport(result: OrchestrationResult): string {
        const features = new Set<string>();

        for (const move of [...result.moved, ...result.alreadyOrganized]) {
            const relPath = relative(this.srcDir, move.currentPath);
            const parts = relPath.split('/');
            if (parts[0]) features.add(parts[0]);
        }

        return `
Test Organization Orchestration Report
========================================

Summary:
- Files organized: ${result.moved.length}
- Directories created: ${result.created.length}
- Already organized: ${result.alreadyOrganized.length}

Target Structure Achieved:
  feature/
    __tests__/
      unit/          # Unit tests
      integration/   # Integration tests

Test Naming Conventions:
- .test.ts or .test.tsx for unit tests
- .integration.test.ts or .integration.test.tsx for integration tests

Next Steps:
1. Update any import paths if tests reference other test files
2. Verify tests pass with new structure: pnpm test
3. Run coverage: pnpm test:coverage
`;
    }
}

// Execute orchestration if run directly
if (require.main === module) {
    const orchestrator = new TestOrganizationOrchestrator();
    const result = orchestrator.execute();
    log.info(orchestrator.generateReport(result));
}
