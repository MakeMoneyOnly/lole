// Department Management System
// Hierarchical agent organization with skill orchestration

import { Skill, AgentResult } from '../orchestrator/agent';

export type TaskState =
    | 'idle'
    | 'operational'
    | 'paused'
    | 'error'
    | 'awaiting_validation'
    | 'blocked_by_subtask'
    | 'requesting_human_input';

export interface TaskForce {
    id: string;
    name: string;
    leadAgents: string[]; // e.g., ['MobileAgent', 'SecAgent']
    activeTaskIds: string[];
    status: 'forming' | 'active' | 'blocked' | 'awaiting_validation' | 'disbanded';
    workingMemory: Record<string, unknown>; // Shared short-term scratchpad
}

export interface DepartmentConfig {
    id: string;
    name: string;
    leadAgent: string;
    coreSkills: string[];
    externalTools?: string[]; // e.g., ['context7', 'exa']
    responsibilities: string[];
    autonomyLevel: number; // 0-100, percentage of autonomous operation
    validationRequired: boolean;
}

export interface DepartmentState {
    id: string;
    status: TaskState;
    activeTasks: string[];
    completedToday: number;
    lastActivity: string;
}

export class DepartmentManager {
    private departments: Map<string, DepartmentConfig>;
    private departmentStates: Map<string, DepartmentState>;
    private taskForces: Map<string, TaskForce>;

    constructor() {
        this.departments = this.loadDepartments();
        this.departmentStates = new Map();
        this.taskForces = new Map();
        this.initializeStates();
    }

    private loadDepartments(): Map<string, DepartmentConfig> {
        const configs: DepartmentConfig[] = [
            // I. Platform Engineering
            {
                id: 'core-runtime',
                name: 'Core Runtime & Gateway',
                leadAgent: 'RuntimeAgent',
                coreSkills: ['architecture-interface-design', 'local-bus-orchestration'],
                externalTools: ['context7'], // Required for fetching latest library specs
                responsibilities: ['Store Gateway logic', 'MQTT transport', 'Local-first runtime'],
                autonomyLevel: 90,
                validationRequired: true,
            },
            {
                id: 'mobile-native',
                name: 'Mobile & Native (Capacitor)',
                leadAgent: 'MobileAgent',
                coreSkills: ['capacitor-native-bridge', 'android-apk-build'],
                responsibilities: [
                    'Android APK stability',
                    'Native plugin bridge',
                    'Device hardware access',
                ],
                autonomyLevel: 85,
                validationRequired: true,
            },
            {
                id: 'sync-persistence',
                name: 'Sync & Persistence',
                leadAgent: 'SyncAgent',
                coreSkills: ['powersync-schema-design', 'conflict-resolution-merging'],
                responsibilities: [
                    'Local SQLite management',
                    'Cloud sync bridge',
                    'Data convergence',
                ],
                autonomyLevel: 95,
                validationRequired: true,
            },
            {
                id: 'frontend-arch',
                name: 'Frontend Architecture',
                leadAgent: 'FrontendAgent',
                coreSkills: ['nextjs-app-router', 'state-management-zustand'],
                responsibilities: [
                    'Component architecture',
                    'Performance optimization',
                    'Frontend state',
                ],
                autonomyLevel: 80,
                validationRequired: false,
            },
            {
                id: 'backend-infra',
                name: 'Backend Infrastructure',
                leadAgent: 'BackendAgent',
                coreSkills: ['postgres-schema-design', 'edge-function-orchestration'],
                responsibilities: ['Database migrations', 'Server-side logic', 'API contracts'],
                autonomyLevel: 85,
                validationRequired: true,
            },

            // II. Security & Compliance
            {
                id: 'cybersecurity',
                name: 'CyberSecurity (SecOps)',
                leadAgent: 'SecAgent',
                coreSkills: ['security-stride-model', 'encryption-at-rest'],
                responsibilities: ['System hardening', 'Auth security', 'Vulnerability scanning'],
                autonomyLevel: 70,
                validationRequired: true,
            },
            {
                id: 'fiscal-compliance',
                name: 'Fiscal Compliance (ERCA)',
                leadAgent: 'FiscalAgent',
                coreSkills: ['mor-sigtas-compliance', 'fiscal-signing-logic'],
                responsibilities: [
                    'Tax law alignment',
                    'Digital receipt validity',
                    'MoR reporting',
                ],
                autonomyLevel: 60,
                validationRequired: true,
            },
            {
                id: 'data-privacy-audit',
                name: 'Data Privacy & Audit',
                leadAgent: 'AuditAgent',
                coreSkills: ['pii-protection-fayda', 'immutable-ledger-design'],
                responsibilities: [
                    'Data classification',
                    'Audit trail integrity',
                    'Compliance reporting',
                ],
                autonomyLevel: 75,
                validationRequired: true,
            },

            // III. Product & UX
            {
                id: 'pos-ux',
                name: 'POS & Operational UX',
                leadAgent: 'POSAgent',
                coreSkills: ['waiter-workflow-design', 'kds-station-optimization'],
                responsibilities: ['POS UI/UX', 'Kitchen workflow efficiency', 'In-store speed'],
                autonomyLevel: 80,
                validationRequired: false,
            },
            {
                id: 'merchant-dash',
                name: 'Merchant Dashboard Product',
                leadAgent: 'DashAgent',
                coreSkills: ['admin-control-plane', 'onboarding-wizard-ux'],
                responsibilities: ['Merchant settings', 'Business configuration', 'Admin tools'],
                autonomyLevel: 85,
                validationRequired: false,
            },
            {
                id: 'guest-exp',
                name: 'Guest Experience (QR/PWA)',
                leadAgent: 'GuestAgent',
                coreSkills: ['qr-ordering-flow', 'loyalty-interface-design'],
                responsibilities: ['Contactless ordering', 'Guest retention tools', 'Self-service'],
                autonomyLevel: 90,
                validationRequired: false,
            },
            {
                id: 'systems-design',
                name: 'Systems Design',
                leadAgent: 'DesignerAgent',
                coreSkills: ['design-system-maintenance', 'accessibility-wcag-audit'],
                responsibilities: ['Global aesthetics', 'Component library', 'Accessibility'],
                autonomyLevel: 75,
                validationRequired: false,
            },

            // IV. Ops, SRE & Hardware
            {
                id: 'devops-sre',
                name: 'DevOps & SRE',
                leadAgent: 'SREAgent',
                coreSkills: ['ci-cd-pipeline-security', 'production-monitoring-sentry'],
                responsibilities: [
                    'Infrastructure uptime',
                    'Deployment safety',
                    'Site reliability',
                ],
                autonomyLevel: 95,
                validationRequired: true,
            },
            {
                id: 'fleet-mgmt',
                name: 'MDM & Fleet Management (Esper)',
                leadAgent: 'MDMAgent',
                coreSkills: ['esper-policy-templates', 'ota-update-orchestration'],
                responsibilities: ['Device provisioning', 'Fleet health', 'Remote management'],
                autonomyLevel: 90,
                validationRequired: true,
            },
            {
                id: 'hardware-ops',
                name: 'Peripheral & Hardware Ops',
                leadAgent: 'HardwareAgent',
                coreSkills: ['esc-pos-driver-design', 'printer-health-reporting'],
                responsibilities: [
                    'Printer stability',
                    'Scanner integration',
                    'Hardware fault detection',
                ],
                autonomyLevel: 85,
                validationRequired: true,
            },

            // V. Data & Intelligence
            {
                id: 'data-engineering',
                name: 'Data Engineering',
                leadAgent: 'DataEngAgent',
                coreSkills: ['timescaledb-hypertables', 'data-aggregation-pipelines'],
                responsibilities: ['Transaction storage', 'High-performance queries', 'Data lakes'],
                autonomyLevel: 90,
                validationRequired: false,
            },
            {
                id: 'strategic-analytics',
                name: 'Strategic Analytics (BI)',
                leadAgent: 'BIAgent',
                coreSkills: ['labor-cost-calculation', 'sales-forecasting-models'],
                responsibilities: ['Executive reporting', 'Z-Reports', 'Actionable insights'],
                autonomyLevel: 80,
                validationRequired: false,
            },
            {
                id: 'ai-orchestration',
                name: 'AI & Orchestration (COL)',
                leadAgent: 'COLAgent',
                coreSkills: ['agent-skill-orchestration', 'governance-auto-alignment'],
                externalTools: ['exa'], // Required for deep architectural and industry research
                responsibilities: ['COL Engine maintenance', 'Agent alignment', 'Autonomous tasks'],
                autonomyLevel: 100,
                validationRequired: false,
            },

            // VI. Growth & Content
            {
                id: 'growth-engineering',
                name: 'Growth Engineering',
                leadAgent: 'GrowthAgent',
                coreSkills: ['seo-performance-optimization', 'conversion-funnel-tracking'],
                responsibilities: ['Landing pages', 'Acquisition funnels', 'Marketing tech'],
                autonomyLevel: 95,
                validationRequired: false,
            },
            {
                id: 'product-marketing',
                name: 'Product Marketing',
                leadAgent: 'PMAgent',
                coreSkills: ['gtm-strategy-development', 'sales-enablement-kits'],
                responsibilities: [
                    'Product messaging',
                    'Launch coordination',
                    'Competitor analysis',
                ],
                autonomyLevel: 85,
                validationRequired: false,
            },
            {
                id: 'content-docs',
                name: 'Content Strategy & Documentation',
                leadAgent: 'WriterAgent',
                coreSkills: ['technical-runbook-authoring', 'merchant-manual-design'],
                responsibilities: ['Technical docs', 'Support manuals', 'In-app copy'],
                autonomyLevel: 90,
                validationRequired: false,
            },

            // VII. Merchant Ops & Finance
            {
                id: 'merchant-success',
                name: 'Merchant Support & Success',
                leadAgent: 'SuccessAgent',
                coreSkills: ['ticket-resolution-workflows', 'merchant-onboarding-training'],
                responsibilities: ['Merchant satisfaction', 'Tier 2/3 support', 'Implementation'],
                autonomyLevel: 80,
                validationRequired: false,
            },
            {
                id: 'billing-finance',
                name: 'Billing, Subscription & Payouts',
                leadAgent: 'FinanceAgent',
                coreSkills: ['subscription-logic-billing', 'reconciliation-settlement'],
                responsibilities: ['SaaS billing', 'Payment settlement', 'Financial audit'],
                autonomyLevel: 75,
                validationRequired: true,
            },
        ];

        return new Map(configs.map(c => [c.id, c]));
    }

    private initializeStates(): void {
        this.departments.forEach(config => {
            this.departmentStates.set(config.id, {
                id: config.id,
                status: 'idle',
                activeTasks: [],
                completedToday: 0,
                lastActivity: new Date().toISOString(),
            });
        });
    }

    getDepartment(id: string): DepartmentConfig | undefined {
        return this.departments.get(id);
    }

    getAllDepartments(): DepartmentConfig[] {
        return Array.from(this.departments.values());
    }

    getState(id: string): DepartmentState {
        return (
            this.departmentStates.get(id) || {
                id,
                status: 'idle',
                activeTasks: [],
                completedToday: 0,
                lastActivity: new Date().toISOString(),
            }
        );
    }

    async setTaskToDepartment(taskId: string, departmentId: string): Promise<boolean> {
        const state = this.departmentStates.get(departmentId);
        if (state) {
            state.activeTasks.push(taskId);
            state.status = 'operational';
            state.lastActivity = new Date().toISOString();
            return true;
        }
        return false;
    }

    async completeTask(taskId: string, departmentId: string, result: AgentResult): Promise<void> {
        const state = this.departmentStates.get(departmentId);
        if (state) {
            state.activeTasks = state.activeTasks.filter(id => id !== taskId);
            if (result.success) {
                state.completedToday++;
            }
            state.status = state.activeTasks.length > 0 ? 'operational' : 'idle';
            state.lastActivity = new Date().toISOString();
        }
    }

    getTasksByDomain(domain: string): string[] {
        const dept = Array.from(this.departments.values()).find(d =>
            d.coreSkills.some(skillId => skillId.includes(domain))
        );
        if (dept) {
            const state = this.departmentStates.get(dept.id);
            return state?.activeTasks || [];
        }
        return [];
    }

    getDepartmentForSkill(skillId: string): string | undefined {
        for (const entry of Array.from(this.departments.entries())) {
            const [id, config] = entry;
            if (config.coreSkills.includes(skillId)) {
                return id;
            }
        }
        return undefined;
    }

    // --- Dynamic Crew Assembly (Task Forces) ---
    createTaskForce(
        name: string,
        departmentIds: string[],
        initialTaskIds: string[] = []
    ): TaskForce {
        const id = 'tf-' + Date.now().toString(36);
        const leadAgents = departmentIds
            .map(dId => this.departments.get(dId)?.leadAgent)
            .filter((agent): agent is string => !!agent);

        const newForce: TaskForce = {
            id,
            name,
            leadAgents,
            activeTaskIds: initialTaskIds,
            status: 'forming',
            workingMemory: {},
        };
        this.taskForces.set(id, newForce);
        return newForce;
    }

    getTaskForce(id: string): TaskForce | undefined {
        return this.taskForces.get(id);
    }

    updateTaskForceState(id: string, updates: Partial<TaskForce>): void {
        const tf = this.taskForces.get(id);
        if (tf) {
            Object.assign(tf, updates);
        }
    }
}

export class DepartmentAgent {
    private config: DepartmentConfig;
    private skills: Skill[];
    private memory: Record<string, unknown>;

    constructor(config: DepartmentConfig, skills: Skill[]) {
        this.config = config;
        this.skills = skills;
        this.memory = {};
    }

    canHandleTask(domain: string): boolean {
        return this.config.coreSkills.some(skillId => {
            const skill = this.skills.find(s => s.id === skillId);
            return skill?.domain === domain;
        });
    }

    getAutonomyLevel(): number {
        return this.config.autonomyLevel;
    }

    requiresValidation(): boolean {
        return this.config.validationRequired;
    }

    getRequiredExternalTools(): string[] {
        return this.config.externalTools || [];
    }

    async executeTask(
        task: { id: string; domain: string; priority: string },
        context: Record<string, unknown>
    ): Promise<AgentResult> {
        this.memory = { ...this.memory, ...context };

        return {
            taskId: task.id,
            success: true,
            output: {
                department: this.config.id,
                leadAgent: this.config.leadAgent,
                skillsUsed: this.config.coreSkills,
            },
            errors: [],
            tokenUsage: 5000,
        };
    }
}
