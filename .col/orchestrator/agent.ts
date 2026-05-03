// Enhanced Orchestrator with Knowledge Base Integration
// Sense-Plan-Act Loop with Documentation-Aware Intelligence

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { KnowledgeBase } from '../knowledge-base/index';
import { TechStackConfig } from '../config/tech-stack';

interface Task {
    id: string;
    title: string;
    domain: string;
    priority: 'high' | 'medium' | 'low';
    dependencies: string[];
    requiredSkills: string[];
    status: 'pending' | 'in-progress' | 'completed' | 'blocked';
    epic?: string;
    assignedAgent?: string;
    tokenBudget?: number;
}

interface Skill {
    id: string;
    name: string;
    description: string;
    complexity: 'low' | 'medium' | 'high';
    execution_mode: 'autonomous' | 'human-in-loop' | 'validation-required';
    domain: string;
    triggers: string[];
    dependencies: string[];
}

interface DomainHealth {
    domain: string;
    status: 'stable' | 'beta' | 'deprecated';
    coverage: number;
    rlsVerified: boolean;
}

interface Blueprint {
    northStarGoal: { vision: string; objectives: string[] };
    codebaseState: { domains: Record<string, DomainHealth> };
}

interface Gap {
    type: 'feature' | 'tech-debt' | 'security';
    domain: string;
    priority: 'high' | 'medium' | 'low';
    description: string;
}

interface AgentContext {
    taskId: string;
    domain: string;
    skills: Skill[];
    memory: Record<string, unknown>;
    tokenBudget: number;
    sessionThread?: string;
}

interface AgentResult {
    taskId: string;
    success: boolean;
    output: Record<string, unknown>;
    errors: string[];
    tokenUsage: number;
}

interface Checkpoint {
    id: string;
    timestamp: string;
    state: 'sense' | 'plan' | 'act' | 'reflect';
    data: Record<string, unknown>;
    signature: string;
}

class ProactiveOrchestrator {
    private pgms: PGMS;
    private skillLibrary: Map<string, Skill>;
    private taskQueue: Task[];
    private parallelWorkers: number;
    private tokenBudget: number;
    private knowledgeBase: KnowledgeBase;
    private techConfig: TechStackConfig;

    constructor(parallelWorkers = 10, tokenBudget = 200000) {
        this.techConfig = new TechStackConfig();
        this.knowledgeBase = new KnowledgeBase();
        this.pgms = new PGMS();
        this.skillLibrary = this.loadSkills();
        this.taskQueue = [];
        this.parallelWorkers = parallelWorkers;
        this.tokenBudget = tokenBudget;
    }

    async runCycle(): Promise<void> {
        await this.sense();
        await this.plan();
        await this.act();
        await this.reflect();
    }

    async sense(): Promise<void> {
        const blueprint = await this.pgms.getBlueprint();
        const healthMap = await this.analyzeCodebaseHealth();
        const gaps = this.identifyGaps(blueprint, healthMap);
        this.taskQueue = this.decomposeIntoTasks(gaps);
        await this.pgms.createCheckpoint('sense', { taskCount: this.taskQueue.length });
    }

    async plan(): Promise<void> {
        const hierarchy = this.buildTaskHierarchy(this.taskQueue);
        hierarchy.forEach(task => {
            task.requiredSkills = this.selectSkillsForTask(task);
            task.tokenBudget = this.estimateTokenBudget(task);
        });
        this.taskQueue = this.topologicalSort(hierarchy);
        await this.pgms.createCheckpoint('plan', { plannedTasks: this.taskQueue.length });
    }

    async act(): Promise<void> {
        const pendingTasks = this.taskQueue.filter(t => t.status === 'pending');
        const batches = this.createBatches(pendingTasks, this.parallelWorkers);

        for (const batch of batches) {
            await Promise.all(batch.map(task => this.deployAgent(task)));
        }

        await this.pgms.createCheckpoint('act', { completedTasks: this.getCompletedCount() });
    }

    async reflect(): Promise<void> {
        const completedTasks = this.taskQueue.filter(t => t.status === 'completed');
        await this.pgms.updateLedger({
            completedTasks: completedTasks.map(t => t.id),
            timestamp: new Date().toISOString(),
        });
        await this.pgms.createCheckpoint('reflect', { progress: this.getProgress() });
    }

    private loadSkills(): Map<string, Skill> {
        const skillsPath = path.join(process.cwd(), '.col/library/skills.yaml');
        try {
            const content = fs.readFileSync(skillsPath, 'utf-8');
            const parsed = yaml.parse(content);
            const skills = new Map<string, Skill>();
            parsed.skills.forEach((s: Skill) => skills.set(s.id, s));
            return skills;
        } catch {
            return new Map();
        }
    }

    private async analyzeCodebaseHealth(): Promise<Map<string, DomainHealth>> {
        const healthPath = path.join(process.cwd(), '.col/memory/living-blueprint.md');
        const content = fs.readFileSync(healthPath, 'utf-8');

        const healthMap = new Map<string, DomainHealth>();
        const domainMatch = content.match(
            /\|\s*(\w+)\s*\|\s*(\w+)\s*\|\s*(\w+)\s*\|\s*(\w+)\s*\|/g
        );
        if (domainMatch) {
            domainMatch.forEach(match => {
                const parts = match.split('|').map(p => p.trim());
                if (parts[1] && parts[2] !== 'Status') {
                    healthMap.set(parts[1], {
                        domain: parts[1],
                        status: (parts[2] as DomainHealth['status']) || 'beta',
                        coverage: parseInt(parts[3]) || 0,
                        rlsVerified: parts[4] === 'verified',
                    });
                }
            });
        }
        return healthMap;
    }

    private identifyGaps(_blueprint: Blueprint, healthMap: Map<string, DomainHealth>): Gap[] {
        const gaps: Gap[] = [];
        healthMap.forEach((health, domain) => {
            if (health.status === 'beta' || health.coverage < 70) {
                gaps.push({
                    type: health.status === 'beta' ? 'feature' : 'tech-debt',
                    domain,
                    priority: health.coverage < 50 ? 'high' : 'medium',
                    description: `Domain ${domain} needs attention (${health.coverage}% coverage)`,
                });
            }
        });
        return gaps;
    }

    private decomposeIntoTasks(gaps: Gap[]): Task[] {
        return gaps.map((gap, i) => ({
            id: `task-${i + 1}`,
            title: gap.description,
            domain: gap.domain,
            priority: gap.priority,
            dependencies: [],
            requiredSkills: [],
            status: 'pending',
        }));
    }

    private buildTaskHierarchy(tasks: Task[]): Task[] {
        return tasks.map(task => ({
            ...task,
            epic: `epic-${task.domain}`,
        }));
    }

    private selectSkillsForTask(task: Task): string[] {
        const matched: string[] = [];
        this.skillLibrary.forEach((skill, id) => {
            if (
                skill.domain === task.domain ||
                skill.triggers.some(t => task.title.toLowerCase().includes(t.toLowerCase()))
            ) {
                matched.push(id);
            }
        });
        return matched.slice(0, 3);
    }

    private estimateTokenBudget(task: Task): number {
        const baseCost = { high: 30000, medium: 15000, low: 5000 }[task.priority];
        return baseCost + task.dependencies.length * 1000;
    }

    private topologicalSort(tasks: Task[]): Task[] {
        return tasks.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }

    private createBatches(tasks: Task[], batchSize: number): Task[][] {
        const batches: Task[][] = [];
        for (let i = 0; i < tasks.length; i += batchSize) {
            batches.push(tasks.slice(i, i + batchSize));
        }
        return batches;
    }

    private async deployAgent(task: Task): Promise<void> {
        task.status = 'in-progress';
        const requiredSkills = task.requiredSkills
            .map(id => this.skillLibrary.get(id))
            .filter((s): s is Skill => s !== undefined);

        const agent = new SubAgent({
            taskId: task.id,
            domain: task.domain,
            skills: requiredSkills,
            memory: await this.pgms.getRelevantContext(task),
            tokenBudget: task.tokenBudget || 15000,
        });

        const result = await agent.execute(task);
        task.status = result.success ? 'completed' : 'blocked';
    }

    private getCompletedCount(): number {
        return this.taskQueue.filter(t => t.status === 'completed').length;
    }

    private getProgress(): number {
        return this.taskQueue.length > 0 ? this.getCompletedCount() / this.taskQueue.length : 0;
    }
}

class PGMS {
    private checkpointDir: string;

    constructor() {
        this.checkpointDir = path.join(process.cwd(), '.col/memory/checkpoints');
        if (!fs.existsSync(this.checkpointDir)) {
            fs.mkdirSync(this.checkpointDir, { recursive: true });
        }
    }

    async getBlueprint(): Promise<Blueprint> {
        const blueprintPath = path.join(process.cwd(), '.col/memory/living-blueprint.md');
        const content = fs.readFileSync(blueprintPath, 'utf-8');

        const visionMatch = content.match(/\*\*Vision:\*\*\s*([\s\S]*?)(?=\n\*\*)/);
        const objectivesMatch = content.match(/(?:Primary Objectives:\n+)([\s\S]*?)(?=\n---)/);
        const objectives = objectivesMatch
            ? objectivesMatch[1].match(/^\d+\.\s+(.+)$/gm)?.map(o => o.replace(/^\d+\.\s+/, '')) ||
              []
            : [];

        return {
            northStarGoal: {
                vision: visionMatch ? visionMatch[1].trim() : '',
                objectives,
            },
            codebaseState: { domains: {} },
        };
    }

    async getRelevantContext(_task: Task): Promise<Record<string, unknown>> {
        return {
            blueprint: await this.getBlueprint(),
            recentCheckpoints: this.listRecentCheckpoints(5),
        };
    }

    async updateLedger(changes: Record<string, unknown>): Promise<void> {
        const ledgerPath = path.join(process.cwd(), '.col/memory/ledger.json');
        let ledger: Record<string, unknown[]> = {};
        if (fs.existsSync(ledgerPath)) {
            ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
        }
        ledger.entries = [...(ledger.entries || []), changes];
        fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
    }

    async createCheckpoint(
        state: Checkpoint['state'],
        data: Record<string, unknown>
    ): Promise<string> {
        const checkpoint: Checkpoint = {
            id: `cp-${Date.now()}`,
            timestamp: new Date().toISOString(),
            state,
            data,
            signature: this.generateSignature(data),
        };
        const checkpointPath = path.join(this.checkpointDir, `${checkpoint.id}.json`);
        fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
        return checkpoint.id;
    }

    listRecentCheckpoints(count: number): Checkpoint[] {
        if (!fs.existsSync(this.checkpointDir)) return [];
        const files = fs
            .readdirSync(this.checkpointDir)
            .filter(f => f.endsWith('.json'))
            .sort()
            .slice(-count);
        return files.map(f =>
            JSON.parse(fs.readFileSync(path.join(this.checkpointDir, f), 'utf-8'))
        );
    }

    private generateSignature(data: Record<string, unknown>): string {
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }
}

class SubAgent {
    private context: AgentContext;
    private result: AgentResult;

    constructor(context: AgentContext) {
        this.context = context;
        this.result = {
            taskId: context.taskId,
            success: false,
            output: {},
            errors: [],
            tokenUsage: 0,
        };
    }

    async execute(task: Task): Promise<AgentResult> {
        try {
            const autonomousSkills = this.context.skills.filter(
                s => s.execution_mode === 'autonomous'
            );
            if (autonomousSkills.length > 0) {
                this.result.output = {
                    task: task.title,
                    skillsUsed: autonomousSkills.map(s => s.id),
                };
                this.result.success = true;
                this.result.tokenUsage = Math.min(this.context.tokenBudget, 10000);
            } else {
                this.result.errors.push('No autonomous skills available');
            }
        } catch (error) {
            this.result.errors.push(error instanceof Error ? error.message : 'Unknown error');
        }
        return this.result;
    }
}

export {
    ProactiveOrchestrator,
    PGMS,
    SubAgent,
    Task,
    Skill,
    AgentContext,
    AgentResult,
    Checkpoint,
};
