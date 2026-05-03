// C-Suite Executive Layer - Strategic Governance for Enterprise Platform
// Defines executive roles with decision-making authority and cross-departmental oversight

import { DepartmentManager, DepartmentConfig } from '../departments/index';

export interface ExecutiveRole {
    id: string;
    title: string;
    rank: number;
    responsibilities: string[];
    decisionAuthority: string[];
    oversees?: string[];
    reportsTo?: string;
    metrics: string[];
}

export interface ExecutiveBoard {
    ceo: ExecutiveRole;
    cto: ExecutiveRole;
    coo: ExecutiveRole;
    cfo: ExecutiveRole;
    cmo: ExecutiveRole;
    cpo: ExecutiveRole;
    chro: ExecutiveRole;
    ciso: ExecutiveRole;
    cdo: ExecutiveRole;
    cro: ExecutiveRole;
}

export class CSuiteGovernance {
    private roles: Map<string, ExecutiveRole>;
    private departments: DepartmentManager;

    constructor() {
        this.departments = new DepartmentManager();
        this.roles = this.initializeCSuite();
    }

    private initializeCSuite(): Map<string, ExecutiveRole> {
        const executives: ExecutiveRole[] = [
            {
                id: 'ceo',
                title: 'Chief Executive Officer',
                rank: 1,
                responsibilities: [
                    'Define and execute company vision and strategy',
                    'Oversee all departments and executive team',
                    'Make final decisions on major strategic initiatives',
                    'Represent company to board and investors',
                    'Ensure alignment with North Star Goal',
                ],
                decisionAuthority: [
                    'Strategic pivots',
                    'Market expansion decisions',
                    'Major partnership agreements',
                    'Budget allocation >$100K',
                    'Hiring/firing C-Suite',
                ],
                metrics: [
                    'Revenue growth YoY',
                    'Market share in Ethiopia',
                    'Customer acquisition cost',
                    'Team retention rate',
                ],
            },
            {
                id: 'cto',
                title: 'Chief Technology Officer',
                rank: 2,
                responsibilities: [
                    'Technical architecture and innovation strategy',
                    'Oversee Engineering, Infrastructure, and DevOps departments',
                    'Ensure technical excellence and scalability',
                    'Evaluate and integrate new technologies',
                    'Maintain system reliability and performance',
                ],
                decisionAuthority: [
                    'Technology stack changes',
                    'Architecture major decisions',
                    'Infrastructure investments',
                    'Security policy implementation',
                    'Technical debt prioritization',
                ],
                oversees: ['engineering', 'infrastructure', 'devops'],
                reportsTo: 'ceo',
                metrics: [
                    'P99 latency <200ms',
                    'System uptime 99.9%',
                    'Deployment frequency',
                    'Tech debt ratio',
                ],
            },
            {
                id: 'coo',
                title: 'Chief Operating Officer',
                rank: 2,
                responsibilities: [
                    'Day-to-day operations execution',
                    'Oversee IT Operations and QA departments',
                    'Streamline processes and workflows',
                    'Ensure operational efficiency',
                    'Manage vendor and partner relationships',
                ],
                decisionAuthority: [
                    'Operational process changes',
                    'Vendor selection/termination',
                    'Deployment scheduling',
                    'Incident response protocols',
                    'Resource allocation',
                ],
                oversees: ['operations', 'qa'],
                reportsTo: 'ceo',
                metrics: [
                    'Deployment success rate',
                    'Mean time to recovery',
                    'Process efficiency gain',
                    'Quality score',
                ],
            },
            {
                id: 'cfo',
                title: 'Chief Financial Officer',
                rank: 2,
                responsibilities: [
                    'Financial strategy and planning',
                    'ERCA fiscal compliance oversight',
                    'Budget management and forecasting',
                    'Revenue optimization',
                    'Financial risk management',
                ],
                decisionAuthority: [
                    'Budget approval >$50K',
                    'Pricing strategy',
                    'Tax compliance decisions',
                    'Financial partnerships',
                    'Cost optimization initiatives',
                ],
                metrics: [
                    'Monthly recurring revenue',
                    'Gross margin %',
                    'ERCA compliance score',
                    'Cash flow health',
                ],
            },
            {
                id: 'cmo',
                title: 'Chief Marketing Officer',
                rank: 2,
                responsibilities: [
                    'Brand strategy and positioning',
                    'Customer acquisition and retention',
                    'Market research and competitive analysis',
                    'Go-to-market strategy',
                    'Partner marketing programs',
                ],
                decisionAuthority: [
                    'Marketing budget allocation',
                    'Brand messaging changes',
                    'Partner program terms',
                    'Launch campaign approval',
                    'PR/communications strategy',
                ],
                metrics: [
                    'Restaurant acquisition rate',
                    'Brand awareness in Addis',
                    'Customer lifetime value',
                    'Marketing ROI',
                ],
            },
            {
                id: 'cpo',
                title: 'Chief Product Officer',
                rank: 2,
                responsibilities: [
                    'Product vision and roadmap',
                    'User experience and design strategy',
                    'Oversee Design department',
                    'Feature prioritization',
                    'Customer feedback integration',
                ],
                decisionAuthority: [
                    'Roadmap prioritization',
                    'UX/UI standards',
                    'Feature scope decisions',
                    'User research initiatives',
                    'Design system evolution',
                ],
                oversees: ['design'],
                reportsTo: 'ceo',
                metrics: [
                    'Feature delivery velocity',
                    'User satisfaction score',
                    'Task completion time',
                    'Design system adoption',
                ],
            },
            {
                id: 'chro',
                title: 'Chief Human Resources Officer',
                rank: 3,
                responsibilities: [
                    'Talent acquisition and retention',
                    'Company culture and values',
                    'Performance management',
                    'Compensation and benefits',
                    'Learning and development',
                ],
                decisionAuthority: [
                    'Hiring standards',
                    'Compensation bands',
                    'Culture initiatives',
                    'Performance review process',
                    'Training program approval',
                ],
                metrics: [
                    'Employee retention rate',
                    'Time to hire',
                    'Employee NPS',
                    'Diversity metrics',
                ],
            },
            {
                id: 'ciso',
                title: 'Chief Information Security Officer',
                rank: 3,
                responsibilities: [
                    'Information security strategy',
                    'Oversee Security department',
                    'Risk assessment and mitigation',
                    'Incident response',
                    'Compliance and audit readiness',
                ],
                decisionAuthority: [
                    'Security policy changes',
                    'Access control decisions',
                    'Incident response activation',
                    'Security tool selection',
                    'Threat assessment priorities',
                ],
                oversees: ['security'],
                reportsTo: 'ceo',
                metrics: [
                    'Security incidents per quarter',
                    'Compliance audit score',
                    'Vulnerability remediation time',
                    'RLS policy coverage',
                ],
            },
            {
                id: 'cdo',
                title: 'Chief Data Officer',
                rank: 3,
                responsibilities: [
                    'Data strategy and governance',
                    'Analytics and insights',
                    'Reporting infrastructure',
                    'Data quality assurance',
                    'ML/AI initiatives',
                ],
                decisionAuthority: [
                    'Data architecture decisions',
                    'Analytics dashboard approval',
                    'Data quality standards',
                    'ML model deployment',
                    'Data retention policies',
                ],
                metrics: [
                    'Data accuracy %',
                    'Report delivery time',
                    'Analytics adoption',
                    'Insight-to-action rate',
                ],
            },
            {
                id: 'cro',
                title: 'Chief Revenue Officer',
                rank: 3,
                responsibilities: [
                    'Revenue strategy and optimization',
                    'Sales team leadership',
                    'Customer success programs',
                    'Payment and billing systems',
                    'Revenue forecasting',
                ],
                decisionAuthority: [
                    'Pricing model changes',
                    'Sales process optimization',
                    'Billing system upgrades',
                    'Customer success initiatives',
                    'Revenue recognition policies',
                ],
                metrics: [
                    'Monthly recurring revenue',
                    'Churn rate',
                    'Average revenue per restaurant',
                    'Payment success rate',
                ],
            },
        ];

        return new Map(executives.map(e => [e.id, e]));
    }

    getExecutive(id: string): ExecutiveRole | undefined {
        return this.roles.get(id);
    }

    getAllExecutives(): ExecutiveRole[] {
        return Array.from(this.roles.values()).sort((a, b) => a.rank - b.rank);
    }

    getExecutivesByDepartment(departmentId: string): ExecutiveRole[] {
        return Array.from(this.roles.values()).filter(role =>
            role.oversees?.includes(departmentId)
        );
    }

    getDecisionAuthority(executiveId: string): string[] {
        return this.roles.get(executiveId)?.decisionAuthority || [];
    }

    validateDecision(executiveId: string, decisionType: string): boolean {
        const authority = this.getDecisionAuthority(executiveId);
        return authority.some(auth => decisionType.toLowerCase().includes(auth.toLowerCase()));
    }

    getBoardMetrics(): Record<string, string[]> {
        const metrics: Record<string, string[]> = {};
        this.roles.forEach(role => {
            metrics[role.id.toUpperCase()] = role.metrics;
        });
        return metrics;
    }

    getOrganizationHierarchy(): {
        executive: ExecutiveRole;
        departments: DepartmentConfig[];
    }[] {
        return Array.from(this.roles.values()).map(executive => ({
            executive,
            departments: executive.oversees
                ? (executive.oversees
                      .map(id => this.departments.getDepartment(id))
                      .filter(Boolean) as DepartmentConfig[])
                : [],
        }));
    }

    simulateQuarterlyPlanning(): {
        theme: string;
        initiatives: { owner: string; initiative: string; expectedImpact: string }[];
    } {
        const ceo = this.roles.get('ceo')!;
        const cto = this.roles.get('cto')!;
        const coo = this.roles.get('coo')!;
        const cpo = this.roles.get('cpo')!;
        const ciso = this.roles.get('ciso')!;

        return {
            theme: 'Enterprise Scale & Production Launch',
            initiatives: [
                {
                    owner: 'CTO',
                    initiative: 'Achieving P99 latency <200ms for core flows',
                    expectedImpact: '40% performance improvement',
                },
                {
                    owner: 'CISO',
                    initiative: 'Complete OWASP Top 10 audit and remediation',
                    expectedImpact: 'Zero critical vulnerabilities',
                },
                {
                    owner: 'CPO',
                    initiative: 'Launch pilot program with 50 restaurants',
                    expectedImpact: 'Validate production readiness',
                },
                {
                    owner: 'COO',
                    initiative: 'Implement automated deployment pipeline',
                    expectedImpact: 'Reduce deployment time by 70%',
                },
                {
                    owner: 'CEO',
                    initiative: 'Finalize Series A funding',
                    expectedImpact: '$2M for 500 restaurant scale',
                },
            ],
        };
    }
}
