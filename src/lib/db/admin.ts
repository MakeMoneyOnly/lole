type InfraDatabaseSource = 'DATABASE_DIRECT_URL' | 'SUPABASE_DB_URL';

export interface InfraDatabaseConfig {
    connectionString: string;
    lane: 'infra';
    mode: 'direct';
    source: InfraDatabaseSource;
}

function isServerlessRuntime(): boolean {
    return (
        process.env.VERCEL === '1' ||
        process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined ||
        process.env.NETLIFY === 'true' ||
        process.env.NEXT_RUNTIME === 'edge'
    );
}

function isPooledSupabaseConnection(connectionString: string): boolean {
    return (
        connectionString.includes('.pooler.supabase.com:6543') ||
        connectionString.includes('@pooler.')
    );
}

export function getInfraDatabaseConfig(
    options: { allowServerless?: boolean } = {}
): InfraDatabaseConfig {
    const connectionString = process.env.DATABASE_DIRECT_URL ?? process.env.SUPABASE_DB_URL;
    const source = process.env.DATABASE_DIRECT_URL ? 'DATABASE_DIRECT_URL' : 'SUPABASE_DB_URL';

    if (!connectionString) {
        throw new Error(
            'Missing infra database lane. Configure DATABASE_DIRECT_URL with the direct Postgres URL.'
        );
    }

    if (isPooledSupabaseConnection(connectionString)) {
        throw new Error(
            `${source} is using a pooler URL. Infra lane must use direct Postgres URL only.`
        );
    }

    if (
        !options.allowServerless &&
        process.env.NODE_ENV === 'production' &&
        isServerlessRuntime()
    ) {
        throw new Error(
            'Direct database lane is blocked in production serverless or edge runtime. Use app lane instead.'
        );
    }

    return {
        connectionString,
        lane: 'infra',
        mode: 'direct',
        source,
    };
}

export function getInfraDatabaseUrl(options?: { allowServerless?: boolean }): string {
    return getInfraDatabaseConfig(options).connectionString;
}
