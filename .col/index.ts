// Cognitive Orchestration Layer - Enterprise Engine
// Hyper-specialized autonomous system for lole Restaurant OS

import { ProactiveOrchestrator } from './orchestrator/agent';
import { DepartmentManager } from './departments/index';
import { ValidationLayer, ContinuousAlignmentChecker } from './validation/validator';
import { KnowledgeBase } from './knowledge-base';
import { TechStackConfig } from './config/tech-stack';
import { CSuiteGovernance } from './executive/c-suite';

export class COLEngine {
    private orchestrator: ProactiveOrchestrator;
    private departments: DepartmentManager;
    private validation: ValidationLayer;
    private knowledgeBase: KnowledgeBase;
    private techConfig: TechStackConfig;
    private checker: ContinuousAlignmentChecker;
    private cSuite: CSuiteGovernance;

    constructor() {
        this.techConfig = new TechStackConfig();
        this.knowledgeBase = new KnowledgeBase();
        this.departments = new DepartmentManager();
        this.validation = new ValidationLayer();
        this.checker = new ContinuousAlignmentChecker();
        this.cSuite = new CSuiteGovernance();
        this.orchestrator = new ProactiveOrchestrator(10, 200000);
    }

    async initialize(): Promise<void> {
        console.log('🚀 COL: Ingesting documentation knowledge base...');
        await this.knowledgeBase.ingestDocs();

        console.log('🧠 COL: Loading tech stack constraints...');
        this.techConfig.validateEnvironment();

        console.log('👔 COL: Initializing C-Suite governance...');
        const planning = this.cSuite.simulateQuarterlyPlanning();
        console.log(`📌 Q2 Theme: ${planning.theme}`);

        console.log('⚡ COL: Ready for enterprise orchestration');
    }

    async runEnterpriseCycle(): Promise<void> {
        await this.orchestrator.runCycle();
    }

    async validateLaunchReadiness(): Promise<{ ready: boolean; checks: Record<string, boolean> }> {
        const results = await this.checker.dailyCheck();
        const checks: Record<string, boolean> = {};
        let ready = true;
        for (const r of results) {
            checks[r.domain] = r.passed;
            if (!r.passed) ready = false;
        }
        return { ready, checks };
    }

    getCSuite(): CSuiteGovernance {
        return this.cSuite;
    }

    getOrganizationChart(): ReturnType<CSuiteGovernance['getOrganizationHierarchy']> {
        return this.cSuite.getOrganizationHierarchy();
    }
}

export {
    ProactiveOrchestrator,
    DepartmentManager,
    ValidationLayer,
    KnowledgeBase,
    TechStackConfig,
    CSuiteGovernance,
};

if (require.main === module) {
    const engine = new COLEngine();
    const command = process.argv[2] || 'health';

    (async () => {
        await engine.initialize();

        switch (command) {
            case 'cycle':
                console.log('🔄 Running full enterprise cycle...');
                await engine.runEnterpriseCycle();
                break;
            case 'sense':
                console.log('📡 Sensing environment and documentation...');
                // Knowledge ingestion is already part of initialization
                console.log('✅ Sensing complete');
                break;
            case 'health':
                console.log('🩺 Checking COL Engine health...');
                const readiness = await engine.validateLaunchReadiness();
                console.log(
                    'Launch Readiness:',
                    readiness.ready ? '✅ READY' : '⚠️ ISSUES DETECTED'
                );
                console.table(readiness.checks);
                break;
            default:
                console.log(`❌ Unknown command: ${command}`);
                console.log('Available commands: cycle, sense, health');
                process.exit(1);
        }
    })().catch(console.error);
}
