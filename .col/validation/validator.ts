// Cognitive Orchestration Layer - Validation Layer
// Ensures alignment with North Star Goal and security requirements

import * as fs from 'fs';
import * as path from 'path';

export interface Change {
    type: 'file' | 'feature' | 'fix' | 'refactor';
    domain: string;
    files: string[];
    description: string;
    author?: string;
}

export interface ValidationError {
    type: 'goal-alignment' | 'architecture' | 'security' | 'compliance';
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    location?: string;
    remediation?: string;
}

export class ValidationLayer {
    private blueprintPath: string;
    private santimPattern = /santim|Santim|amount_santim/i;
    private secretPatterns = [/api[_-]?key/i, /secret/i, /password/i, /token/i, /[a-z0-9]{32,}/];

    constructor() {
        this.blueprintPath = path.join(process.cwd(), '.col/memory/living-blueprint.md');
    }

    async validateImplementation(change: Change): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];

        errors.push(...(await this.checkGoalAlignment(change)));
        errors.push(...(await this.checkArchitectureCompliance(change)));
        errors.push(...(await this.checkSecurityRules(change)));
        errors.push(...(await this.checkComplianceRequirements(change)));

        return errors;
    }

    private async checkGoalAlignment(change: Change): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];

        if (change.domain === 'payments' || change.domain === 'orders') {
            const content = await this.getFileContent(change.files);
            if (this.requiresSantimFromContent(content) && !this.santimPattern.test(content)) {
                errors.push({
                    type: 'goal-alignment',
                    severity: 'high',
                    message: `${change.domain} domain must use Santim integer pattern for financial values`,
                    location: change.files.join(', '),
                    remediation:
                        'Rename "amount" or "price" to "amount_santim" or "price_santim" and use Integers',
                });
            }
        }

        return errors;
    }

    private async checkArchitectureCompliance(change: Change): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];

        for (const file of change.files) {
            if (file.includes('domain') && !this.hasValidDomainStructure(file)) {
                errors.push({
                    type: 'architecture',
                    severity: 'high',
                    message: `Domain ${change.domain} missing required 3-file pattern (resolvers, service, repository)`,
                    location: file,
                    remediation: 'Ensure resolvers.ts, service.ts, and repository.ts exist',
                });
            }
        }

        return errors;
    }

    private async checkSecurityRules(change: Change): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];

        if (
            (await this.modifiesTenantData(change.files)) &&
            !(await this.hasRlsConsideration(change.files))
        ) {
            errors.push({
                type: 'security',
                severity: 'critical',
                message: 'Tenant data changes require RLS consideration and restaurant_id scoping',
                location: change.files.join(', '),
                remediation: 'Add restaurant_id filters and verify RLS policies in SQL',
            });
        }

        const secretsFound = await this.scanForSecrets(change.files);
        if (secretsFound.length > 0) {
            errors.push({
                type: 'security',
                severity: 'critical',
                message: `Potential secrets detected: ${secretsFound.join(', ')}`,
                location: change.files.join(', '),
                remediation: 'Remove secrets and use environment variables',
            });
        }

        return errors;
    }

    private async checkComplianceRequirements(change: Change): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];

        if (change.domain === 'payments' || change.domain === 'orders') {
            errors.push({
                type: 'compliance',
                severity: 'medium',
                message: 'Financial domains require ERCA fiscal compliance validation',
                location: change.files.join(', '),
                remediation: 'Verify against volt-agent/compliance/nutrient-document-processing',
            });
        }

        return errors;
    }

    private hasValidDomainStructure(file: string): boolean {
        const domainMatch = file.match(/src\/domains\/(\w+)/);
        if (domainMatch) {
            const domain = domainMatch[1];
            const requiredFiles = ['resolvers.ts', 'service.ts', 'repository.ts'];
            return requiredFiles.every(f =>
                fs.existsSync(path.join(process.cwd(), `src/domains/${domain}/${f}`))
            );
        }
        return true;
    }

    private async getFileContent(files: string[]): Promise<string> {
        let combinedContent = '';
        for (const file of files) {
            const absolutePath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
            if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
                combinedContent += fs.readFileSync(absolutePath, 'utf-8');
            }
        }
        return combinedContent;
    }

    private requiresSantimFromContent(content: string): boolean {
        return /price|amount|total|cost/i.test(content) && !content.includes('santim');
    }

    private async modifiesTenantData(files: string[]): Promise<boolean> {
        const tenantTables = ['orders', 'payments', 'menu_items', 'staff', 'guests'];
        const content = await this.getFileContent(files);
        return tenantTables.some(t => content.includes(t));
    }

    private async hasRlsConsideration(files: string[]): Promise<boolean> {
        const content = await this.getFileContent(files);
        return content.includes('restaurant_id') || content.includes('RLS');
    }

    private async scanForSecrets(files: string[]): Promise<string[]> {
        const found: string[] = [];
        for (const file of files) {
            const absolutePath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
            if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
                const content = fs.readFileSync(absolutePath, 'utf-8');
                this.secretPatterns.forEach(pattern => {
                    const matches = content.match(pattern);
                    if (matches) {
                        found.push(...matches.slice(0, 3));
                    }
                });
            }
        }
        return Array.from(new Set(found));
    }
}

export class ContinuousAlignmentChecker {
    private validator: ValidationLayer;

    constructor() {
        this.validator = new ValidationLayer();
    }

    async dailyCheck(): Promise<{ domain: string; passed: boolean }[]> {
        const results: { domain: string; passed: boolean }[] = [];
        const domains = ['orders', 'payments', 'menu', 'staff', 'guests'];
        for (const domain of domains) {
            const change: Change = {
                type: 'fix',
                domain,
                files: [`src/domains/${domain}/**/*.ts`],
                description: `Daily alignment check for ${domain}`,
            };
            const errors = await this.validator.validateImplementation(change);
            results.push({ domain, passed: errors.length === 0 });
        }
        return results;
    }

    async weeklyComplianceAudit(): Promise<{ domain: string; errors: ValidationError[] }[]> {
        const results: { domain: string; errors: ValidationError[] }[] = [];
        const domains = ['payments', 'orders'];

        for (const domain of domains) {
            const change: Change = {
                type: 'feature',
                domain,
                files: [`src/domains/${domain}/**/*.ts`],
                description: `Weekly compliance audit`,
            };
            const errors = await this.validator.validateImplementation(change);
            results.push({ domain, errors });
        }

        return results;
    }
}
