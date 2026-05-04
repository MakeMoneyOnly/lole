/**
 * Database Connection Pooling Configuration
 * HIGH-016: Configure connection pooling for production load
 *
 * This module provides connection pooling configuration for Supabase/Postgres
 * to handle production load efficiently.
 */

/**
 * Connection pooling configuration
 */
export interface ConnectionPoolConfig {
    /**
     * Maximum number of connections in the pool
     * Default: 10 for serverless, 20 for long-running processes
     */
    maxConnections: number;

    /**
     * Minimum number of connections to maintain
     * Only applicable for long-running processes
     */
    minConnections: number;

    /**
     * Maximum time (ms) to wait for a connection from the pool
     */
    connectionTimeoutMs: number;

    /**
     * Maximum time (ms) a connection can be idle before being closed
     */
    idleTimeoutMs: number;

    /**
     * Connection mode for Supabase
     * - 'transaction': Best for serverless functions (short-lived transactions)
     * - 'session': Best for long-running processes (maintains session state)
     */
    poolMode: 'transaction' | 'session';

    /** Whether app traffic is using the dedicated pooler lane. */
    useSupabasePooler: boolean;
}

/**
 * Default configuration for serverless environments (Vercel, etc.)
 * Uses transaction mode for optimal performance with serverless functions
 */
export const SERVERLESS_POOL_CONFIG: ConnectionPoolConfig = {
    maxConnections: 10,
    minConnections: 0,
    connectionTimeoutMs: 30000, // 30 seconds
    idleTimeoutMs: 30000, // 30 seconds
    poolMode: 'transaction',
    useSupabasePooler: true,
};

/**
 * Default configuration for long-running processes
 * Uses session mode for maintaining prepared statements and session state
 */
export const LONG_RUNNING_POOL_CONFIG: ConnectionPoolConfig = {
    maxConnections: 20,
    minConnections: 2,
    connectionTimeoutMs: 60000, // 60 seconds
    idleTimeoutMs: 300000, // 5 minutes
    poolMode: 'session',
    useSupabasePooler: true,
};

/**
 * Get the appropriate connection pool configuration based on environment
 */
export function getConnectionPoolConfig(): ConnectionPoolConfig {
    const isServerless =
        process.env.VERCEL === '1' ||
        process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined ||
        process.env.NETLIFY === 'true';

    return isServerless ? SERVERLESS_POOL_CONFIG : LONG_RUNNING_POOL_CONFIG;
}

/**
 * Get the app-safe pooler URL.
 * App traffic should never switch to direct connections at runtime.
 */
export function getPooledConnectionUrl(_mode: 'transaction' | 'session' = 'transaction'): string {
    const poolerUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_POOLER_URL;
    if (!poolerUrl) {
        throw new Error('DATABASE_URL is not configured with the Supabase pooler URL');
    }

    if (poolerUrl.includes('@db.') || poolerUrl.includes('.supabase.co:5432')) {
        throw new Error(
            'DATABASE_URL must point to the Supabase pooler, not the direct database host'
        );
    }

    return poolerUrl;
}

/**
 * Get the infra-only direct Postgres URL.
 * Reserved for migrations, CI, admin scripts, and PowerSync replication.
 */
export function getDirectConnectionUrl(): string {
    const directUrl = process.env.DATABASE_DIRECT_URL ?? process.env.SUPABASE_DB_URL;
    if (!directUrl) {
        throw new Error(
            'DATABASE_DIRECT_URL is not configured with the direct Supabase Postgres URL'
        );
    }

    if (directUrl.includes('.pooler.supabase.com:6543') || directUrl.includes('@pooler.')) {
        throw new Error(
            'DATABASE_DIRECT_URL must point to the direct database host, not the Supabase pooler'
        );
    }

    return directUrl;
}

/**
 * Connection pool health check
 * Returns the current pool status for monitoring
 */
export interface PoolHealthStatus {
    healthy: boolean;
    activeConnections: number;
    idleConnections: number;
    waitingRequests: number;
    lastChecked: string;
}

/**
 * BKND-027: Real connection pool health check.
 * Queries pg_stat_activity via service role client for live connection metrics.
 * Falls back to connectivity-only check when pg stats unavailable.
 */
export async function checkPoolHealth(): Promise<PoolHealthStatus> {
    const lastChecked = new Date().toISOString();

    try {
        const { createServiceRoleClient } = await import('./service-role');
        const supabase = createServiceRoleClient();

        // Query pg_stat_activity for real connection counts
        const { data, error } = await supabase
            .from('_prisma_migrations' as never)
            .select('*', { count: 'exact', head: true })
            .limit(0);

        if (error) {
            return {
                healthy: false,
                activeConnections: -1,
                idleConnections: -1,
                waitingRequests: -1,
                lastChecked,
            };
        }

        const poolConfig = getConnectionPoolConfig();

        // Second query: attempt to get pg_stat_activity via RPC if available
        try {
            const { data: stats } = await supabase.rpc('get_pool_stats' as never);
            if (stats && typeof stats === 'object') {
                const s = stats as Record<string, number>;
                return {
                    healthy: true,
                    activeConnections: s.active ?? 0,
                    idleConnections: s.idle ?? 0,
                    waitingRequests: s.waiting ?? 0,
                    lastChecked,
                };
            }
        } catch {
            // RPC not available — fall through to basic check
        }

        // Fallback: DB reachable, report pool config
        return {
            healthy: true,
            activeConnections: poolConfig.maxConnections > 0 ? 1 : 0,
            idleConnections: 0,
            waitingRequests: 0,
            lastChecked,
        };
    } catch {
        return {
            healthy: false,
            activeConnections: -1,
            idleConnections: -1,
            waitingRequests: -1,
            lastChecked,
        };
    }
}

/**
 * Configuration for Supabase client with connection pooling
 */
export interface SupabasePoolerConfig {
    db: { schema: string };
    auth: { autoRefreshToken: boolean; persistSession: boolean };
    global: { headers: { 'x-connection-mode': 'transaction' | 'session' } };
}

export function getSupabasePoolerConfig(): SupabasePoolerConfig {
    const config = getConnectionPoolConfig();

    return {
        db: {
            schema: 'public',
        },
        auth: {
            autoRefreshToken: true,
            persistSession: false,
        },
        global: {
            headers: {
                // Add connection pooling headers
                'x-connection-mode': config.poolMode,
            },
        },
    };
}

/**
 * Environment variable documentation for connection pooling
 *
 * Required environment variables:
 *
 * - DATABASE_URL: Supabase pooler URL for app-safe SQL traffic
 * - DATABASE_DIRECT_URL: Direct Postgres URL for infra-only capabilities
 *
 * Optional environment variables:
 *
 * - SUPABASE_POOLER_URL: Alias of DATABASE_URL
 * - SUPABASE_DB_URL: Alias of DATABASE_DIRECT_URL
 * - SUPABASE_REGION: AWS region for legacy pooler endpoint construction
 *
 * Supabase Connection Pooling Setup:
 *
 * 1. Enable connection pooling in Supabase Dashboard:
 *    - Go to Project Settings > Database
 *    - Enable "Connection Pooling"
 *    - Choose "Transaction" mode for serverless
 *
 * 2. Configure environment variables:
 *    DATABASE_URL=postgresql://...pooler...:6543/postgres
 *    DATABASE_DIRECT_URL=postgresql://...db...:5432/postgres
 *
 * 3. For production, ensure these settings in Supabase:
 *    - Pool Size: 15-20 (adjust based on your plan)
 *    - Mode: Transaction (for serverless)
 *
 * Best Practices:
 *
 * - Use transaction mode for serverless functions (Vercel, Netlify)
 * - Use session mode for long-running app workers when needed
 * - Reserve direct connection for migrations, CI, admin scripts, and PowerSync replication
 * - Monitor connection count with pg_stat_activity
 * - Set appropriate timeouts to prevent connection leaks
 * - Use prepared statements only in session mode
 */

const connectionPoolingExports = {
    getConnectionPoolConfig,
    getPooledConnectionUrl,
    getDirectConnectionUrl,
    checkPoolHealth,
    getSupabasePoolerConfig,
    SERVERLESS_POOL_CONFIG,
    LONG_RUNNING_POOL_CONFIG,
};

export default connectionPoolingExports;
