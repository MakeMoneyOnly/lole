import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logServiceRoleAudit, type ServiceRoleAuditParams } from '@/lib/audit';
import { logger } from '@/lib/logger';

const log = logger.child('supabase:service-role');

/**
 * Creates an audited service role client that automatically logs all database operations.
 *
 * This wrapper intercepts database operations and logs them to the audit_logs table
 * for security compliance (P0 requirement).
 *
 * @param source - The source of the operation (API route, function, cron job, etc.)
 * @param defaultParams - Default audit parameters
 * @returns Wrapped Supabase client with automatic audit logging
 */
export function createAuditedServiceRoleClient(
    source: string,
    defaultParams?: Partial<Omit<ServiceRoleAuditParams, 'action' | 'description' | 'success'>>
): SupabaseClient {
    const supabase = createServiceRoleClient();

    // Return a proxy that wraps operations with audit logging
    return new Proxy(supabase, {
        get(target, prop) {
            const originalProperty = target[prop as keyof typeof target];

            if (typeof originalProperty === 'function') {
                // Return a wrapped function that logs operations
                return async (...args: unknown[]) => {
                    const operation = prop as string;
                    const startTime = Date.now();

                    try {
                        // Execute the original operation
                        const result = await (
                            originalProperty as (...args: unknown[]) => Promise<unknown>
                        ).apply(target, args);

                        // Log successful operation
                        const duration = Date.now() - startTime;
                        const successMetadata: Record<string, unknown> = {
                            _operation: operation,
                            _duration_ms: duration,
                            _args_summary: summarizeArgs(args),
                        };
                        if (defaultParams?.metadata && typeof defaultParams.metadata === 'object') {
                            Object.assign(successMetadata, defaultParams.metadata);
                        }

                        await logServiceRoleAudit({
                            action: operation.toUpperCase(),
                            description: `Service role ${operation} operation completed successfully`,
                            source: source,
                            resourceType: extractResourceType(args),
                            resourceId: extractResourceId(args),
                            success: true,
                            metadata: successMetadata as import('@/types/database').Json,
                            userId: defaultParams?.userId,
                            restaurantId: defaultParams?.restaurantId,
                            ipAddress: defaultParams?.ipAddress,
                        });

                        return result;
                    } catch (error) {
                        // Log failed operation
                        const duration = Date.now() - startTime;
                        const failedMetadata: Record<string, unknown> = {
                            _operation: operation,
                            _duration_ms: duration,
                            _error: error instanceof Error ? error.message : String(error),
                            _args_summary: summarizeArgs(args),
                        };
                        if (defaultParams?.metadata && typeof defaultParams.metadata === 'object') {
                            Object.assign(failedMetadata, defaultParams.metadata);
                        }

                        await logServiceRoleAudit({
                            action: operation.toUpperCase(),
                            description: `Service role ${operation} operation failed`,
                            source: source,
                            resourceType: extractResourceType(args),
                            resourceId: extractResourceId(args),
                            success: false,
                            metadata: failedMetadata as import('@/types/database').Json,
                            userId: defaultParams?.userId,
                            restaurantId: defaultParams?.restaurantId,
                            ipAddress: defaultParams?.ipAddress,
                        });

                        throw error;
                    }
                };
            }

            return originalProperty;
        },
    });
}

/**
 * Extract resource type from operation arguments
 */
function extractResourceType(args: unknown[]): string {
    if (Array.isArray(args) && args.length > 0) {
        const firstArg = args[0];
        if (typeof firstArg === 'string') {
            return firstArg; // Table name
        }
    }
    return 'unknown';
}

/**
 * Extract resource ID from operation arguments
 */
function extractResourceId(args: unknown[]): string | undefined {
    if (Array.isArray(args) && args.length > 1) {
        const secondArg = args[1];
        if (secondArg && typeof secondArg === 'object') {
            const obj = secondArg as Record<string, unknown>;
            // Look for common ID fields
            if (obj.id) return String(obj.id);
            if (obj.ids && Array.isArray(obj.ids)) return obj.ids.join(',');
            if (obj.order_id) return String(obj.order_id);
            if (obj.restaurant_id) return String(obj.restaurant_id);
        }
    }
    return undefined;
}

/**
 * Create a summary of arguments for audit logging (sanitized)
 */
function summarizeArgs(args: unknown[]): string {
    if (!Array.isArray(args) || args.length === 0) return '[]';

    try {
        const summary = args.map((arg, index) => {
            if (index === 0) {
                // First arg is usually table name
                return typeof arg === 'string' ? arg : 'unknown';
            }
            if (typeof arg === 'object' && arg !== null) {
                // Summarize object arguments (exclude sensitive data)
                const obj = arg as Record<string, unknown>;
                const safeKeys = ['id', 'ids', 'restaurant_id', 'order_id', 'status'];
                const summarized: Record<string, unknown> = {};

                for (const key of safeKeys) {
                    if (key in obj) summarized[key] = obj[key];
                }

                return Object.keys(summarized).length > 0 ? JSON.stringify(summarized) : '{...}';
            }
            return String(arg).substring(0, 100);
        });

        return JSON.stringify(summary);
    } catch {
        return '[args]';
    }
}

export function createServiceRoleClient(): SupabaseClient {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Use the new Secret Key (sb_secret_...)
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseKey) {
        // During build time, return a placeholder to prevent crash
        if (process.env.NEXT_PHASE === 'phase-production-build') {
            return createClient(
                supabaseUrl || 'https://placeholder.supabase.co',
                supabaseKey || 'placeholder-key'
            );
        }

        log.error('CRITICAL ERROR: Supabase Administrative configuration missing.', undefined, {
            urlSet: !!supabaseUrl,
            secretKeySet: supabaseKey ? `Set (Length: ${supabaseKey.length})` : 'Missing',
            envKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE')),
        });
        throw new Error('Missing Supabase Administrative configuration');
    }

    return createClient(supabaseUrl, supabaseKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
        db: {
            schema: 'public',
        },
    });
}
