import { UpdateType, type AbstractPowerSyncDatabase } from '@powersync/web';
import { getSupabaseClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

const DEFAULT_POWERSYNC_ENDPOINT = 'https://69b2c04ad42a43395101a793.powersync.journeyapps.com';

interface SyncApiOperation {
    id: string;
    operation: 'create' | 'update' | 'delete';
    tableName: string;
    recordId: string;
    data: Record<string, unknown>;
    version: number;
    lastModified: string;
    idempotencyKey: string;
    restaurantId: string;
}

function getConfiguredEndpoint(): string {
    return process.env.NEXT_PUBLIC_POWERSYNC_ENDPOINT ?? DEFAULT_POWERSYNC_ENDPOINT;
}

function getDevelopmentToken(): string {
    return process.env.POWERSYNC_ACCESS_TOKEN ?? '';
}

function getOperationType(updateType: UpdateType): SyncApiOperation['operation'] {
    switch (updateType) {
        case UpdateType.PUT:
            return 'create';
        case UpdateType.PATCH:
            return 'update';
        case UpdateType.DELETE:
            return 'delete';
    }
}

function getRecordTimestamp(data: Record<string, unknown>): string {
    const timestamp =
        data.last_modified ?? data.updated_at ?? data.created_at ?? new Date().toISOString();

    return typeof timestamp === 'string' ? timestamp : new Date().toISOString();
}

function getRestaurantId(data: Record<string, unknown>): string {
    const restaurantId =
        data.restaurant_id ?? data.restaurantId ?? process.env.NEXT_PUBLIC_RESTAURANT_ID ?? '';

    return typeof restaurantId === 'string' ? restaurantId : '';
}

export class Connector {
    async fetchCredentials(): Promise<{ endpoint: string; token: string } | null> {
        const endpoint = getConfiguredEndpoint();
        const developmentToken = getDevelopmentToken();

        if (developmentToken) {
            logger.info('[PowerSync] Using development token for remote sync', {
                tokenLength: developmentToken.length,
            });
            return {
                endpoint,
                token: developmentToken,
            };
        }

        logger.info('[PowerSync] Attempting to fetch credentials from Supabase session');
        const {
            data: { session },
            error,
        } = await getSupabaseClient().auth.getSession();

        if (error) {
            logger.error('[PowerSync] Failed to fetch Supabase session', { error: error.message });
            return null;
        }

        const token = session?.access_token;
        if (!token) {
            logger.warn('[PowerSync] No active Supabase session found for remote sync', {
                hasSession: !!session,
                userId: session?.user?.id,
            });
            return null;
        }

        logger.info('[PowerSync] Successfully retrieved Supabase access token', {
            userId: session?.user?.id,
        });
        return {
            endpoint,
            token,
        };
    }

    async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
        const batch = await database.getCrudBatch();
        if (!batch || batch.crud.length === 0) {
            return;
        }

        const operations: SyncApiOperation[] = batch.crud
            .map(entry => {
                const data = (entry.opData ?? {}) as Record<string, unknown>;
                const restaurantId = getRestaurantId(data);

                if (!restaurantId) {
                    logger.warn('[PowerSync] Skipping upload for row without restaurant scope', {
                        table: entry.table,
                        recordId: entry.id,
                    });
                    return null;
                }

                return {
                    id: crypto.randomUUID(),
                    operation: getOperationType(entry.op),
                    tableName: entry.table,
                    recordId: entry.id,
                    data,
                    version: typeof data.version === 'number' ? data.version : 1,
                    lastModified: getRecordTimestamp(data),
                    idempotencyKey:
                        typeof data.idempotency_key === 'string'
                            ? data.idempotency_key
                            : `powersync-${entry.table}-${entry.id}-${entry.clientId}`,
                    restaurantId,
                } satisfies SyncApiOperation;
            })
            .filter((operation): operation is SyncApiOperation => operation !== null);

        if (operations.length === 0) {
            await batch.complete();
            return;
        }

        const response = await fetch('/api/v1/system/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                operations,
                clientId: 'powersync-web-client',
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`PowerSync upload failed: ${response.status} ${errorText}`);
        }

        await batch.complete();
    }
}

export const POWERSYNC_INSTANCE_URL = DEFAULT_POWERSYNC_ENDPOINT;
