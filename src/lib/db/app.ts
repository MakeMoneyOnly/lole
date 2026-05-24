type AppDatabaseSource = 'DATABASE_URL' | 'SUPABASE_POOLER_URL';

export interface AppDatabaseConfig {
    connectionString: string;
    lane: 'app';
    mode: 'pooler';
    source: AppDatabaseSource;
}

function isDirectSupabaseConnection(connectionString: string): boolean {
    return connectionString.includes('@db.') || connectionString.includes('.supabase.co:5432');
}

export function getAppDatabaseConfig(): AppDatabaseConfig {
    const connectionString = process.env.DATABASE_URL ?? process.env.SUPABASE_POOLER_URL;
    const source = process.env.DATABASE_URL ? 'DATABASE_URL' : 'SUPABASE_POOLER_URL';

    if (!connectionString) {
        throw new Error(
            'Missing app database lane. Configure DATABASE_URL with the Supabase pooler URL.'
        );
    }

    if (isDirectSupabaseConnection(connectionString)) {
        throw new Error(
            `${source} is using a direct Postgres URL. App lane must use Supabase pooler URL only.`
        );
    }

    return {
        connectionString,
        lane: 'app',
        mode: 'pooler',
        source,
    };
}

export function getAppDatabaseUrl(): string {
    return getAppDatabaseConfig().connectionString;
}
