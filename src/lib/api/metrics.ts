import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';

type TrackApiMetricParams = {
    restaurantId?: string | null;
    endpoint: string;
    method: string;
    statusCode: number;
    durationMs: number;
};

export const API_METRIC_ACTION = 'api_metric_recorded';
export const API_METRIC_ENTITY_TYPE = 'api_endpoint';

export async function trackApiMetric(
    supabase: SupabaseClient<Database>,
    params: TrackApiMetricParams
): Promise<{ error: Error | null }> {
    const isError = params.statusCode >= 400;

    const metadata: Json = {
        endpoint: params.endpoint,
        method: params.method.toUpperCase(),
        status_code: params.statusCode,
        duration_ms: params.durationMs,
        is_error: isError,
        source: 'api_observability',
    };

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof (supabase as any).from !== 'function') {
            return { error: null };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const query = supabase.from('audit_logs') as any;
        if (typeof query.insert !== 'function') {
            return { error: null };
        }

        const { error } = await query.insert({
            restaurant_id: params.restaurantId ?? null,
            action: API_METRIC_ACTION,
            entity_type: API_METRIC_ENTITY_TYPE,
            metadata,
            new_value: {
                endpoint: params.endpoint,
                status_code: params.statusCode,
                duration_ms: params.durationMs,
                is_error: isError,
            } as Json,
        });

        return { error };
    } catch {
        return { error: null };
    }
}
