// Tech Stack Configuration - Aligned with .env.example
// Defines constraints and capabilities for the reasoning engine

interface TechConstraint {
    layer: 'frontend' | 'backend' | 'database' | 'infrastructure' | 'compliance';
    component: string;
    requirement: string;
    envVar?: string;
    critical: boolean;
}

export class TechStackConfig {
    public readonly constraints: TechConstraint[] = [
        {
            layer: 'frontend',
            component: 'Next.js',
            requirement: 'App Router with React Server Components',
            envVar: 'NEXT_PUBLIC_APP_URL',
            critical: true,
        },
        {
            layer: 'frontend',
            component: 'React',
            requirement: 'Version 19 with concurrent features',
            envVar: null,
            critical: true,
        },
        {
            layer: 'frontend',
            component: 'Capacitor',
            requirement: 'Native shell for Android POS/KDS hardware',
            envVar: 'NEXT_PUBLIC_CAPACITOR_SERVER_URL',
            critical: true,
        },
        {
            layer: 'backend',
            component: 'Apollo Router',
            requirement: 'Rust-based federation gateway on Railway',
            envVar: 'APOLLO_GRAPH_ID',
            critical: true,
        },
        {
            layer: 'backend',
            component: 'Apollo Server',
            requirement: 'Federation subgraph server on Vercel',
            envVar: null,
            critical: true,
        },
        {
            layer: 'database',
            component: 'PostgreSQL',
            requirement: 'Supabase 15 with RLS multi-tenancy',
            envVar: 'DATABASE_URL',
            critical: true,
        },
        {
            layer: 'database',
            component: 'TimescaleDB',
            requirement: 'Time-series extension for analytics',
            envVar: null,
            critical: true,
        },
        {
            layer: 'database',
            component: 'PowerSync',
            requirement: 'CRDT-based offline-first sync',
            envVar: 'NEXT_PUBLIC_POWERSYNC_ENDPOINT',
            critical: true,
        },
        {
            layer: 'infrastructure',
            component: 'Upstash Redis',
            requirement: 'Serverless cache and event bus',
            envVar: 'UPSTASH_REDIS_REST_URL',
            critical: false,
        },
        {
            layer: 'infrastructure',
            component: 'QStash',
            requirement: 'Durable background job queue',
            envVar: 'QSTASH_TOKEN',
            critical: false,
        },
        {
            layer: 'infrastructure',
            component: 'Cloudflare R2',
            requirement: 'Object storage with Africa edge',
            envVar: 'CLOUDFLARE_R2_BUCKET_NAME',
            critical: false,
        },
        {
            layer: 'compliance',
            component: 'ERCA',
            requirement: 'Ethiopian tax e-invoicing compliance',
            envVar: 'ERCA_API_KEY',
            critical: true,
        },
        {
            layer: 'compliance',
            component: 'Santim',
            requirement: 'Integer monetary unit (100 santim = 1 ETB)',
            envVar: null,
            critical: true,
        },
    ];

    public readonly layers = {
        frontend: [
            'Next.js 16',
            'React 19',
            'TypeScript 5',
            'Tailwind CSS 4',
            'Zustand',
            'Capacitor 8',
        ],
        backend: [
            'Next.js API Routes',
            'Apollo Server 5',
            'Apollo Router',
            'NestJS (Phase 2)',
            'Supabase Edge Functions',
        ],
        database: ['Supabase PostgreSQL 15', 'TimescaleDB', 'PowerSync', 'RLS'],
        infrastructure: ['Vercel', 'Railway', 'Upstash Redis/QStash', 'Cloudflare R2/KV/WAF'],
        compliance: ['ERCA e-invoicing', 'MoR Fiscal', 'Santim integers'],
    };

    public readonly domains = [
        'orders',
        'payments',
        'menu',
        'staff',
        'inventory',
        'tables',
        'customers',
        'suppliers',
    ];

    public readonly ethiopiaConstraints = [
        'Works offline or degrades gracefully for Addis power cuts',
        'Payable from Ethiopia (no Stripe/AWS restrictions)',
        'Africa-edge CDN (Nairobi/Johannesburg PoPs)',
        'Solo-builder operable (no dedicated DevOps required)',
    ];

    public readonly invariants = [
        'Local-First Always: Core flows work without internet',
        'Security by RLS: Multi-tenancy via restaurant_id at DB layer',
        'Integer Money: Santim for all ETB values',
        'Mobile-First UX: Touch-optimized layouts',
        'Zero-Waste Logging: Structured Axiom logs tagged with restaurant_id',
    ];

    validateEnvironment(): void {
        const missing: string[] = [];
        for (const constraint of this.constraints.filter(c => c.critical)) {
            if (constraint.envVar && !process.env[constraint.envVar]) {
                missing.push(constraint.envVar);
            }
        }
        if (missing.length > 0) {
            console.warn(`⚠️ Critical environment variables missing: ${missing.join(', ')}`);
        }
    }

    isSantimValue(value: string | number): boolean {
        if (typeof value === 'number') {
            return Number.isInteger(value) && value >= 0;
        }
        if (typeof value === 'string') {
            return /^\d+$/.test(value);
        }
        return false;
    }

    santimToETB(santim: number): number {
        return santim / 100;
    }

    etbToSantim(etb: number): number {
        return Math.round(etb * 100);
    }
}
