import { apiError, apiSuccess } from '@/lib/api/response';
import { requireMerchantAuth } from '../../shared/auth-middleware';
import { GetKDSQueueQuerySchema } from '../contracts';
type SlaFilter = 'on_track' | 'at_risk' | 'breached';

const ACTIVE_KDS_STATUSES = ['pending', 'confirmed', 'acknowledged', 'preparing', 'ready'] as const;

export interface UnifiedKDSOrder {
    id: string;
    source:
        | 'dine-in'
        | 'direct_delivery'
        | 'direct_pickup'
        | 'beu'
        | 'zmall'
        | 'telebirr_food'
        | 'deliver_addis'
        | 'esoora';
    sourceLabel: string;
    sourceColor: string;
    orderNumber: string;
    tableNumber?: string;
    customerName?: string;
    items: Array<{
        id: string;
        kds_item_id?: string;
        name: string;
        quantity: number;
        notes?: string;
        station?: string;
        course?: 'appetizer' | 'main' | 'dessert' | 'beverage' | 'side';
        status?: string;
        order_item_id?: string;
        modifiers?: string[];
    }>;
    station: string;
    status: string;
    priority: 'normal' | 'high' | 'urgent';
    createdAt: string;
    acknowledgedAt?: string;
    elapsedMinutes: number;
    slaStatus: SlaFilter;
    driverInfo?: {
        status: 'pending' | 'assigned' | 'arrived';
        name?: string;
        phone?: string;
        etaMinutes?: number;
    };
    externalOrderId?: string;
    fireMode?: 'auto' | 'manual';
    currentCourse?: 'appetizer' | 'main' | 'dessert' | 'beverage' | 'side' | null;
}

interface QueueResponse {
    orders: UnifiedKDSOrder[];
    total: number;
    cursor: {
        next: string | null;
        has_more: boolean;
    };
}

function calculateElapsedMinutes(createdAt: string): number {
    return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
}

function resolvePriority(elapsedMinutes: number, slaMinutes: number): 'normal' | 'high' | 'urgent' {
    if (elapsedMinutes >= slaMinutes + 10) return 'urgent';
    if (elapsedMinutes >= slaMinutes) return 'high';
    return 'normal';
}

function resolveSlaStatus(elapsedMinutes: number, slaMinutes: number): SlaFilter {
    if (elapsedMinutes >= slaMinutes) return 'breached';
    if (elapsedMinutes >= Math.floor(slaMinutes * 0.75)) return 'at_risk';
    return 'on_track';
}

export async function getKDSQueueHandler(request: Request): Promise<Response> {
    try {
        const auth = await requireMerchantAuth(request);

        if (!auth.ok) {
            return auth.response;
        }

        const { supabase, restaurantId } = auth;

        const url = new URL(request.url);
        const rawQuery = {
            restaurantId: restaurantId,
            status: url.searchParams.get('status') ?? undefined,
            station: url.searchParams.get('station') ?? undefined,
            sla_status: url.searchParams.get('sla_status') ?? undefined,
            sla_minutes: url.searchParams.get('sla_minutes') ?? undefined,
            cursor: url.searchParams.get('cursor') ?? undefined,
            limit: url.searchParams.get('limit') ?? undefined,
        };

        const validated = GetKDSQueueQuerySchema.parse(rawQuery);
        const { status, station, sla_status, sla_minutes, limit } = validated;

        const statuses = status ? [status] : [...ACTIVE_KDS_STATUSES];
        const fetchLimit = Math.min(limit * 2, 200);

        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('id, order_number, table_number, created_at, acknowledged_at, status, items')
            .eq('restaurant_id', restaurantId)
            .in('status', statuses)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .limit(fetchLimit);

        if (ordersError) {
            return apiError(
                'Failed to fetch KDS queue',
                500,
                'KDS_QUEUE_FETCH_FAILED',
                ordersError.message
            );
        }

        const unified: UnifiedKDSOrder[] = [];

        for (const rawOrder of (orders ?? []) as Array<Record<string, unknown>>) {
            const createdAt = String(rawOrder.created_at ?? '');
            if (!createdAt) continue;

            const elapsedMinutes = calculateElapsedMinutes(createdAt);
            const slaState = resolveSlaStatus(elapsedMinutes, sla_minutes);

            const fallbackItems = Array.isArray(rawOrder.items)
                ? (rawOrder.items as Array<Record<string, unknown>>)
                : [];

            const normalizedItems = fallbackItems.map((item, idx) => ({
                id: String(item.id ?? `${rawOrder.id}-item-${idx}`),
                name: String(item.name ?? 'Item'),
                quantity: Number(item.quantity ?? 1),
                notes: item.notes ? String(item.notes) : undefined,
                station: typeof item.station === 'string' ? item.station.toLowerCase() : 'kitchen',
                status: String(item.status ?? 'queued'),
            }));

            if (normalizedItems.length === 0) continue;

            const ticketStation =
                normalizedItems.length === 1 ? normalizedItems[0].station : 'multi';

            if (station !== 'all' && ticketStation !== station && station !== 'expeditor') {
                continue;
            }

            if (sla_status && slaState !== sla_status) continue;

            unified.push({
                id: String(rawOrder.id),
                source: 'dine-in' as const,
                sourceLabel: 'Dine In',
                sourceColor: '#DC2626',
                orderNumber: String(rawOrder.order_number ?? rawOrder.id),
                tableNumber: rawOrder.table_number ? String(rawOrder.table_number) : undefined,
                items: normalizedItems,
                station: ticketStation,
                status: String(rawOrder.status ?? 'pending'),
                priority: resolvePriority(elapsedMinutes, sla_minutes),
                createdAt,
                acknowledgedAt: rawOrder.acknowledged_at
                    ? String(rawOrder.acknowledged_at)
                    : undefined,
                elapsedMinutes,
                slaStatus: slaState,
                fireMode: String(rawOrder.fire_mode ?? 'auto') === 'manual' ? 'manual' : 'auto',
                currentCourse: rawOrder.current_course
                    ? (rawOrder.current_course as UnifiedKDSOrder['currentCourse'])
                    : null,
            });
        }

        unified.sort((a, b) => {
            const aTs = new Date(a.createdAt).getTime();
            const bTs = new Date(b.createdAt).getTime();
            if (aTs !== bTs) return aTs - bTs;
            return a.id.localeCompare(b.id);
        });

        const page = unified.slice(0, limit);
        const hasMore = unified.length > limit;

        return apiSuccess<QueueResponse>({
            orders: page,
            total: page.length,
            cursor: {
                next:
                    hasMore && page.length > 0
                        ? Buffer.from(
                              JSON.stringify({
                                  createdAt: page[page.length - 1].createdAt,
                                  id: page[page.length - 1].id,
                              }),
                              'utf-8'
                          ).toString('base64url')
                        : null,
                has_more: hasMore,
            },
        });
    } catch (error) {
        return apiError(error, 500, 'INTERNAL_ERROR', undefined, {
            operation: 'getKDSQueue',
        });
    }
}
