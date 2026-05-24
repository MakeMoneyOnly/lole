/**
 * Supabase Connection Pool Configuration
 *
 * Configures connection pooling via Supavisor for improved database performance.
 *
 * @see https://supabase.com/docs/guides/database/connection-pooling
 *
 * Pool Mode Options:
 * - transaction: Connections are borrowed for a single query/transaction (recommended for most use cases)
 * - session: Connections persist for the full client session (use only if you need session features)
 *
 * Environment Variables:
 * - DATABASE_URL: App-safe pooler URL
 * - DATABASE_DIRECT_URL: Infra-only direct URL
 * - SUPABASE_POOL_MODE: transaction or session
 * - SUPABASE_POOL_SIZE: Connections per instance
 * - SUPABASE_POOL_MAX_CLIENTS: Max clients in pool
 * - SUPABASE_POOL_CONNECTION_TIMEOUT: Connection timeout in seconds
 * - SUPABASE_POOL_IDLE_TIMEOUT: Idle timeout in seconds
 * - SUPABASE_POOLER_URL: Optional alias of DATABASE_URL
 */

export interface PoolConfig {
    enabled: boolean;
    mode: 'transaction' | 'session';
    poolSize: number;
    maxClients: number;
    connectionTimeout: number;
    idleTimeout: number;
    poolerUrl?: string;
}

/**
 * Get connection pool configuration from environment
 */
export function getPoolConfig(): PoolConfig {
    const enabled = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_POOLER_URL);
    const mode = (process.env.SUPABASE_POOL_MODE as 'transaction' | 'session') || 'transaction';
    const poolSize = parseInt(process.env.SUPABASE_POOL_SIZE || '10', 10);
    const maxClients = parseInt(process.env.SUPABASE_POOL_MAX_CLIENTS || '20', 10);
    const connectionTimeout = parseInt(process.env.SUPABASE_POOL_CONNECTION_TIMEOUT || '30', 10);
    const idleTimeout = parseInt(process.env.SUPABASE_POOL_IDLE_TIMEOUT || '1800', 10);
    const poolerUrl = process.env.SUPABASE_POOLER_URL;

    return {
        enabled,
        mode,
        poolSize: Math.min(Math.max(poolSize, 1), 50), // Clamp between 1-50
        maxClients: Math.min(Math.max(maxClients, 1), 100), // Clamp between 1-100
        connectionTimeout: Math.min(Math.max(connectionTimeout, 1), 300), // Clamp between 1-300s
        idleTimeout: Math.min(Math.max(idleTimeout, 60), 3600), // Clamp between 60-3600s
        poolerUrl,
    };
}

/**
 * Check if connection pooling lane is configured
 */
export function isPoolEnabled(): boolean {
    return Boolean(process.env.DATABASE_URL || process.env.SUPABASE_POOLER_URL);
}

/**
 * Get the pooler URL for direct pooler connections
 * Falls back to constructing from project URL if not explicitly set
 */
export function getPoolerUrl(): string | undefined {
    const config = getPoolConfig();
    if (process.env.DATABASE_URL) {
        return process.env.DATABASE_URL;
    }

    if (config.poolerUrl) {
        return config.poolerUrl;
    }

    // If explicit pooler URL is not set, construct from project URL as a fallback.
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (projectUrl && config.enabled) {
        // Extract project ref from URL: https://xxx.supabase.co -> xxx
        const match = projectUrl.match(/https?:\/\/([^.]+)\.supabase/);
        if (match) {
            const projectRef = match[1];
            // Pooler uses port 6543 with -pooler suffix
            return `postgresql://postgres@pooler.${projectRef}.supabase.co:6543/postgres`;
        }
    }

    return undefined;
}

/**
 * Default pool configuration for reference
 */
export const DEFAULT_POOL_CONFIG: PoolConfig = {
    enabled: true,
    mode: 'transaction',
    poolSize: 10,
    maxClients: 20,
    connectionTimeout: 30,
    idleTimeout: 1800, // 30 minutes
};
