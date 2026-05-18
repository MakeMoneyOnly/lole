import type { UnifiedKDSOrder } from '@/app/api/v1/merchant/operations/kds/queue/route';
import { normalizeKdsPrintPolicy, DEFAULT_KDS_PRINT_POLICY } from './printer';
import { getPowerSync } from '@/lib/sync';

type StationFilter =
    | 'all'
    | 'kitchen'
    | 'bar'
    | 'dessert'
    | 'coffee'
    | 'grill'
    | 'cold'
    | 'expeditor';

interface QueueFilters {
    station: StationFilter;
    limit: number;
    slaMinutes: number;
}

interface KdsSettingsPayload {
    ready_auto_archive_minutes: number;
    alert_policy: {
        new_ticket_sound: boolean;
        sla_breach_visual: boolean;
        recall_visual: boolean;
        quiet_hours_enabled: boolean;
        quiet_hours_start: string;
        quiet_hours_end: string;
    };
    print_policy: ReturnType<typeof normalizeKdsPrintPolicy>;
}

interface AdapterResult<T> {
    ok: boolean;
    mode?: 'local' | 'api';
    data?: T;
    error?: string;
}

const DEFAULT_READY_AUTO_ARCHIVE_MINUTES = 15;
const DEFAULT_ALERT_POLICY = {
    new_ticket_sound: true,
    sla_breach_visual: true,
    recall_visual: true,
    quiet_hours_enabled: false,
    quiet_hours_start: '23:00',
    quiet_hours_end: '06:00',
};
const ACTIVE_ORDER_STATUSES = new Set([
    'pending',
    'confirmed',
    'acknowledged',
    'preparing',
    'ready',
]);

function normalizeAlertPolicy(input: unknown): KdsSettingsPayload['alert_policy'] {
    const raw = (input ?? {}) as Record<string, unknown>;
    return {
        new_ticket_sound:
            typeof raw.new_ticket_sound === 'boolean'
                ? raw.new_ticket_sound
                : DEFAULT_ALERT_POLICY.new_ticket_sound,
        sla_breach_visual:
            typeof raw.sla_breach_visual === 'boolean'
                ? raw.sla_breach_visual
                : DEFAULT_ALERT_POLICY.sla_breach_visual,
        recall_visual:
            typeof raw.recall_visual === 'boolean'
                ? raw.recall_visual
                : DEFAULT_ALERT_POLICY.recall_visual,
        quiet_hours_enabled:
            typeof raw.quiet_hours_enabled === 'boolean'
                ? raw.quiet_hours_enabled
                : DEFAULT_ALERT_POLICY.quiet_hours_enabled,
        quiet_hours_start:
            typeof raw.quiet_hours_start === 'string'
                ? raw.quiet_hours_start
                : DEFAULT_ALERT_POLICY.quiet_hours_start,
        quiet_hours_end:
            typeof raw.quiet_hours_end === 'string'
                ? raw.quiet_hours_end
                : DEFAULT_ALERT_POLICY.quiet_hours_end,
    };
}

function resolveSlaStatus(
    elapsedMinutes: number,
    slaMinutes: number
): 'on_track' | 'at_risk' | 'breached' {
    if (elapsedMinutes >= slaMinutes) return 'breached';
    if (elapsedMinutes >= Math.floor(slaMinutes * 0.75)) return 'at_risk';
    return 'on_track';
}

function stationMatches(station: string, filter: StationFilter): boolean {
    if (filter === 'all' || filter === 'expeditor') return true;
    return station === filter || station === 'multi';
}

function parseModifiers(raw: string | null | undefined): string[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw) as unknown;
        return Array.isArray(parsed) ? parsed.map(value => String(value)) : [];
    } catch {
        return [];
    }
}

function isKdsFireMode(value: string | null | undefined): value is 'auto' | 'manual' {
    return value === 'auto' || value === 'manual';
}

function isKdsCourseName(
    value: string | null | undefined
): value is 'appetizer' | 'main' | 'dessert' | 'beverage' | 'side' {
    return (
        value === 'appetizer' ||
        value === 'main' ||
        value === 'dessert' ||
        value === 'beverage' ||
        value === 'side'
    );
}

async function readLocalKdsSettings(): Promise<KdsSettingsPayload> {
    const db = getPowerSync();
    const row = await db?.getFirstAsync<{ settings_json: string }>(
        `SELECT settings_json FROM restaurant_settings LIMIT 1`
    );

    const settings = row?.settings_json
        ? (JSON.parse(row.settings_json) as Record<string, unknown>)
        : {};
    const kds = (settings.kds ?? {}) as Record<string, unknown>;

    return {
        ready_auto_archive_minutes:
            typeof kds.ready_auto_archive_minutes === 'number'
                ? Math.max(0, Math.min(180, Math.floor(kds.ready_auto_archive_minutes)))
                : DEFAULT_READY_AUTO_ARCHIVE_MINUTES,
        alert_policy: normalizeAlertPolicy(kds.alert_policy),
        print_policy: normalizeKdsPrintPolicy(
            (kds.print_policy as Record<string, unknown> | undefined) ?? DEFAULT_KDS_PRINT_POLICY
        ),
    };
}

export async function readKdsSettings(): Promise<AdapterResult<KdsSettingsPayload>> {
    const db = getPowerSync();
    if (db) {
        return {
            ok: true,
            mode: 'local',
            data: await readLocalKdsSettings(),
        };
    }

    const response = await fetch('/api/v1/merchant/core/settings/kds');
    const payload = (await response.json()) as { data?: KdsSettingsPayload; error?: string };
    if (!response.ok || !payload.data) {
        return {
            ok: false,
            error: payload.error ?? 'Failed to fetch KDS settings',
        };
    }

    return {
        ok: true,
        mode: 'api',
        data: payload.data,
    };
}

export async function readKdsQueue(filters: QueueFilters): Promise<
    AdapterResult<{
        orders: UnifiedKDSOrder[];
        policies: { ready_auto_archive_minutes: number };
    }>
> {
    const db = getPowerSync();
    if (!db) {
        const query = new URLSearchParams({
            station: filters.station,
            limit: String(filters.limit),
            sla_minutes: String(filters.slaMinutes),
        });
        const response = await fetch(`/api/v1/merchant/operations/kds/queue?${query.toString()}`);
        const payload = (await response.json()) as {
            data?: { orders: UnifiedKDSOrder[]; policies: { ready_auto_archive_minutes: number } };
            error?: string;
        };
        if (!response.ok || !payload.data) {
            return {
                ok: false,
                error: payload.error ?? 'Failed to fetch KDS queue',
            };
        }
        return {
            ok: true,
            mode: 'api',
            data: payload.data,
        };
    }

    const [orders, items, settings] = await Promise.all([
        db.getAllAsync<{
            id: string;
            order_number: string;
            table_number: string | null;
            created_at: string;
            acknowledged_at: string | null;
            status: string;
            fire_mode: string | null;
            current_course: string | null;
        }>(
            `SELECT id, order_number, table_number, created_at, NULL as acknowledged_at, status, fire_mode, current_course
             FROM orders
             ORDER BY created_at ASC
             LIMIT ?`,
            [filters.limit]
        ),
        db.getAllAsync<{
            id: string;
            order_id: string;
            name: string;
            quantity: number;
            notes: string | null;
            station: string | null;
            course: 'appetizer' | 'main' | 'dessert' | 'beverage' | 'side' | null;
            order_item_id: string;
            modifiers_json: string | null;
            kds_item_id: string;
            kds_status: string;
        }>(
            `SELECT
                oi.id,
                oi.order_id,
                oi.menu_item_name as name,
                oi.quantity,
                oi.notes,
                COALESCE(ki.station, oi.station, 'kitchen') as station,
                NULL as course,
                oi.id as order_item_id,
                oi.modifiers_json,
                ki.id as kds_item_id,
                COALESCE(ki.status, oi.status, 'queued') as kds_status
             FROM order_items oi
             LEFT JOIN kds_items ki ON ki.order_item_id = oi.id`
        ),
        readLocalKdsSettings(),
    ]);

    const itemsByOrder = new Map<string, typeof items>();
    for (const item of items) {
        const itemStation = item.station ?? 'kitchen';
        if (!stationMatches(itemStation, filters.station)) continue;
        const existing = itemsByOrder.get(item.order_id) ?? [];
        existing.push(item);
        itemsByOrder.set(item.order_id, existing);
    }

    const localOrders: UnifiedKDSOrder[] = orders
        .filter(order => ACTIVE_ORDER_STATUSES.has(order.status))
        .map(order => {
            const orderItems = itemsByOrder.get(order.id) ?? [];
            const createdAt = order.created_at;
            const elapsedMinutes = Math.max(
                0,
                Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
            );
            return {
                id: order.id,
                source: 'dine-in' as const,
                sourceLabel: 'Dine In',
                sourceColor: '#DC2626',
                orderNumber: String(order.order_number ?? ''),
                tableNumber: order.table_number ?? undefined,
                items: orderItems.map(item => ({
                    id: item.id,
                    kds_item_id: item.kds_item_id,
                    name: item.name,
                    quantity: Number(item.quantity ?? 1),
                    notes: item.notes ?? undefined,
                    station: item.station ?? 'kitchen',
                    course: item.course ?? 'main',
                    status: item.kds_status,
                    order_item_id: item.order_item_id,
                    modifiers: parseModifiers(item.modifiers_json),
                })),
                station:
                    [...new Set(orderItems.map(item => item.station ?? 'kitchen'))].length > 1
                        ? 'multi'
                        : (orderItems[0]?.station ?? 'kitchen'),
                status: order.status,
                priority: 'normal' as const,
                createdAt,
                acknowledgedAt: order.acknowledged_at ?? undefined,
                elapsedMinutes,
                slaStatus: resolveSlaStatus(elapsedMinutes, filters.slaMinutes),
                fireMode: isKdsFireMode(order.fire_mode) ? order.fire_mode : 'auto',
                currentCourse: isKdsCourseName(order.current_course) ? order.current_course : null,
            };
        })
        .filter(order => stationMatches(order.station, filters.station))
        .slice(0, filters.limit);

    return {
        ok: true,
        mode: 'local',
        data: {
            orders: localOrders,
            policies: {
                ready_auto_archive_minutes: settings.ready_auto_archive_minutes,
            },
        },
    };
}
