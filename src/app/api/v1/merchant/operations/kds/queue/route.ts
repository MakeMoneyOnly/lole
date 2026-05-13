/**
 * KDS Unified Queue API
 *
 * GET /api/kds/queue
 *
 * Dedicated queue endpoint for KDS and expeditor surfaces with:
 * - auth/device scoped restaurant context
 * - station and SLA filters
 * - cursor pagination
 */

import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import {
    getAuthenticatedUser,
    getAuthorizedRestaurantContext,
    getDeviceContext,
} from '@/lib/api/authz';
import { parseQuery } from '@/lib/api/validation';
import type { TablesInsert } from '@/types/database';

type StationFilter =
    | 'all'
    | 'kitchen'
    | 'bar'
    | 'dessert'
    | 'coffee'
    | 'grill'
    | 'cold'
    | 'expeditor';
type SlaFilter = 'on_track' | 'at_risk' | 'breached';

const ACTIVE_KDS_STATUSES = ['pending', 'confirmed', 'acknowledged', 'preparing', 'ready'] as const;

const DEFAULT_READY_AUTO_ARCHIVE_MINUTES = 15;

const QueueRequestSchema = z.object({
    status: z.enum(ACTIVE_KDS_STATUSES).optional(),
    station: z
        .enum(['all', 'kitchen', 'bar', 'dessert', 'coffee', 'grill', 'cold', 'expeditor'])
        .default('all'),
    sla_status: z.enum(['on_track', 'at_risk', 'breached']).optional(),
    sla_minutes: z.coerce.number().int().min(5).max(180).default(30),
    cursor: z.string().min(8).max(400).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
});

interface CursorToken {
    createdAt: string;
    id: string;
}

interface QueueResponse {
    orders: QueueItem[];
    total: number;
    summary: {
        dineIn: number;
        directDelivery: number;
        directPickup: number;
        partners: number;
    };
    cursor: {
        next: string | null;
        has_more: boolean;
    };
    filters: {
        status: string | null;
        station: string;
        sla_status: string | null;
        sla_minutes: number;
    };
    policies: {
        ready_auto_archive_minutes: number;
        auto_archived_in_this_fetch: number;
    };
}

interface QueueItem {
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

export type UnifiedKDSOrder = QueueItem;

const SOURCE_CONFIG = {
    'dine-in': { label: 'Dine In', color: '#DC2626' },
    direct_delivery: { label: 'Delivery', color: '#2563EB' },
    direct_pickup: { label: 'Pickup', color: '#16A34A' },
    beu: { label: 'Beu', color: '#F97316' },
    zmall: { label: 'Zmall', color: '#22C55E' },
    telebirr_food: { label: 'Telebirr Food', color: '#EAB308' },
    deliver_addis: { label: 'Deliver Addis', color: '#8B5CF6' },
    esoora: { label: 'Esoora', color: '#06B6D4' },
};

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

function decodeCursor(cursor: string): CursorToken | null {
    try {
        const raw = Buffer.from(cursor, 'base64url').toString('utf-8');
        const parsed = JSON.parse(raw) as CursorToken;
        if (!parsed?.createdAt || !parsed?.id) return null;
        if (Number.isNaN(new Date(parsed.createdAt).getTime())) return null;
        return parsed;
    } catch {
        try {
            const raw = Buffer.from(cursor, 'base64').toString('utf-8');
            const parsed = JSON.parse(raw) as CursorToken;
            if (!parsed?.createdAt || !parsed?.id) return null;
            if (Number.isNaN(new Date(parsed.createdAt).getTime())) return null;
            return parsed;
        } catch {
            return null;
        }
    }
}

function encodeCursor(cursor: CursorToken): string {
    return Buffer.from(JSON.stringify(cursor), 'utf-8').toString('base64url');
}

function isAfterCursor(item: QueueItem, cursor: CursorToken): boolean {
    const itemTs = new Date(item.createdAt).getTime();
    const cursorTs = new Date(cursor.createdAt).getTime();
    if (itemTs > cursorTs) return true;
    if (itemTs < cursorTs) return false;
    return item.id > cursor.id;
}

function stationMatches(item: QueueItem, station: StationFilter): boolean {
    if (station === 'all' || station === 'expeditor') return true;
    if (item.station === station || item.station === 'multi') return true;
    return item.items.some(line => (line.station ?? 'kitchen') === station);
}

function resolveItemStation(station: unknown): string {
    if (typeof station !== 'string' || station.trim() === '') return 'kitchen';
    return station.trim().toLowerCase();
}

function resolveTicketStation(stations: string[]): string {
    const unique = [...new Set(stations.filter(Boolean))];
    if (unique.length === 0) return 'unassigned';
    if (unique.length > 1) return 'multi';
    return unique[0];
}

const COURSE_SEQUENCE = ['appetizer', 'main', 'dessert', 'beverage', 'side'] as const;
type CourseType = (typeof COURSE_SEQUENCE)[number];

function normalizeCourse(value: unknown): CourseType {
    if (typeof value !== 'string') return 'main';
    const normalized = value.trim().toLowerCase();
    return (COURSE_SEQUENCE as readonly string[]).includes(normalized)
        ? (normalized as CourseType)
        : 'main';
}

function shouldIncludeItemByFireMode(params: {
    fireMode: unknown;
    currentCourse: unknown;
    itemCourse: unknown;
}): boolean {
    const fireMode = String(params.fireMode ?? 'auto').toLowerCase();
    if (fireMode !== 'manual') return true;

    const currentCourseRaw = params.currentCourse;
    const activeCourse =
        typeof currentCourseRaw === 'string' && currentCourseRaw.trim().length > 0
            ? normalizeCourse(currentCourseRaw)
            : 'appetizer';
    const itemCourse = normalizeCourse(params.itemCourse);

    return itemCourse === activeCourse;
}

function mapOrderStatusToKdsItemStatus(orderStatus: string): string {
    if (orderStatus === 'ready') return 'ready';
    if (orderStatus === 'preparing' || orderStatus === 'acknowledged') return 'in_progress';
    return 'queued';
}

function resolveReadyAutoArchiveMinutes(settings: unknown): number {
    if (!settings || typeof settings !== 'object') {
        return DEFAULT_READY_AUTO_ARCHIVE_MINUTES;
    }

    const kds = (settings as Record<string, unknown>).kds;
    if (!kds || typeof kds !== 'object') {
        return DEFAULT_READY_AUTO_ARCHIVE_MINUTES;
    }

    const rawMinutes = (kds as Record<string, unknown>).ready_auto_archive_minutes;
    if (typeof rawMinutes !== 'number' || Number.isNaN(rawMinutes)) {
        return DEFAULT_READY_AUTO_ARCHIVE_MINUTES;
    }

    return Math.max(0, Math.min(180, Math.floor(rawMinutes)));
}

async function autoArchiveReadyOrders(params: {
    db: Awaited<ReturnType<typeof getAuthorizedRestaurantContext>>['supabase'];
    restaurantId: string;
    actorUserId: string | null;
    readyAutoArchiveMinutes: number;
}) {
    const { db, restaurantId, actorUserId, readyAutoArchiveMinutes } = params;

    if (readyAutoArchiveMinutes <= 0) {
        return 0;
    }

    const archiveBuilder = db?.from?.('orders');
    if (!archiveBuilder || typeof archiveBuilder.update !== 'function') {
        return 0;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const cutoffIso = new Date(now.getTime() - readyAutoArchiveMinutes * 60_000).toISOString();

    const { data: archivedOrders, error: archiveError } = await archiveBuilder
        .update({
            status: 'served',
            updated_at: nowIso,
        })
        .eq('restaurant_id', restaurantId)
        .eq('status', 'ready')
        .lte('completed_at', cutoffIso)
        .select('id');

    if (archiveError) {
        return 0;
    }

    const orderIds = ((archivedOrders ?? []) as Array<{ id?: string }>)
        .map(row => String(row.id ?? ''))
        .filter(Boolean);
    if (orderIds.length === 0) {
        return 0;
    }

    await Promise.all([
        db!.from('order_events').insert(
            orderIds.map(orderId => ({
                restaurant_id: restaurantId,
                order_id: orderId,
                event_type: 'status_changed',
                from_status: 'ready',
                to_status: 'served',
                actor_user_id: actorUserId,
                metadata: {
                    source: 'kds_auto_archive',
                    ready_auto_archive_minutes: readyAutoArchiveMinutes,
                },
            }))
        ),
        db!.from('audit_logs').insert(
            orderIds.map(orderId => ({
                restaurant_id: restaurantId,
                user_id: actorUserId,
                action: 'kds_ticket_auto_archived',
                entity_type: 'order',
                entity_id: orderId,
                metadata: {
                    source: 'kds_auto_archive',
                    ready_auto_archive_minutes: readyAutoArchiveMinutes,
                },
                old_value: { status: 'ready' },
                new_value: { status: 'served' },
            }))
        ),
    ]);

    return orderIds.length;
}

export async function GET(request: Request) {
    const auth = await getAuthenticatedUser();

    let restaurantId: string | null = null;
    let db: Awaited<ReturnType<typeof getAuthorizedRestaurantContext>>['supabase'] | null = null;

    if (auth.ok) {
        const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
        if (!context.ok) {
            return context.response;
        }
        restaurantId = context.restaurantId;
        db = context.supabase;
    } else {
        const hasDeviceToken = Boolean(request.headers.get('x-device-token'));
        if (!hasDeviceToken) {
            return auth.response;
        }

        const device = await getDeviceContext(request);
        if (!device.ok) {
            return device.response;
        }

        restaurantId = device.restaurantId;
        db = device.admin;
    }

    const url = new URL(request.url);
    const parsed = parseQuery(
        {
            status: url.searchParams.get('status') ?? undefined,
            station: url.searchParams.get('station') ?? undefined,
            sla_status: url.searchParams.get('sla_status') ?? undefined,
            sla_minutes: url.searchParams.get('sla_minutes') ?? undefined,
            cursor: url.searchParams.get('cursor') ?? undefined,
            limit: url.searchParams.get('limit') ?? undefined,
        },
        QueueRequestSchema
    );
    if (!parsed.success) {
        return parsed.response;
    }

    const { status, station, sla_status, sla_minutes, limit, cursor } = parsed.data;
    const decodedCursor = cursor ? decodeCursor(cursor) : null;
    if (cursor && !decodedCursor) {
        return apiError('Invalid cursor token', 400, 'INVALID_CURSOR');
    }

    const statuses = status ? [status] : [...ACTIVE_KDS_STATUSES];
    const fetchLimit = Math.min(limit * 4, 400);
    const actorUserId = auth.ok ? auth.user.id : null;

    const restaurantSettingsBuilder = db
        .from('restaurants')
        .select('settings')
        .eq('id', restaurantId);
    const { data: restaurantSettingsRows } = await (typeof restaurantSettingsBuilder.maybeSingle ===
    'function'
        ? restaurantSettingsBuilder.maybeSingle()
        : restaurantSettingsBuilder.limit(1));
    const restaurantSettingsRow = Array.isArray(restaurantSettingsRows)
        ? restaurantSettingsRows[0]
        : restaurantSettingsRows;
    const readyAutoArchiveMinutes = resolveReadyAutoArchiveMinutes(restaurantSettingsRow?.settings);
    const autoArchivedCount = restaurantId
        ? await autoArchiveReadyOrders({
              db,
              restaurantId,
              actorUserId,
              readyAutoArchiveMinutes,
          })
        : 0;

    const { data: dineInOrders, error: dineInError } = await db
        .from('orders')
        .select(
            'id, order_number, table_number, created_at, acknowledged_at, status, items, fire_mode, current_course'
        )
        .eq('restaurant_id', restaurantId)
        .in('status', statuses)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(fetchLimit);

    if (dineInError) {
        return apiError(
            'Failed to fetch KDS dine-in queue',
            500,
            'KDS_QUEUE_FETCH_FAILED',
            dineInError.message
        );
    }

    const { data: externalOrders, error: externalError } = await db
        .from('external_orders')
        .select(
            'id, provider, provider_order_id, payload_json, normalized_status, created_at, acknowledged_at'
        )
        .eq('restaurant_id', restaurantId)
        .in('normalized_status', statuses)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(fetchLimit);

    if (externalError) {
        return apiError(
            'Failed to fetch KDS external queue',
            500,
            'KDS_QUEUE_FETCH_FAILED',
            externalError.message
        );
    }

    const unified: QueueItem[] = [];

    const dineInOrderIds = ((dineInOrders ?? []) as Array<{ id: string }>)
        .map(row => row.id)
        .filter(Boolean);
    const orderItemsByOrder = new Map<string, Array<Record<string, unknown>>>();
    const kdsItemsByOrder = new Map<string, Array<Record<string, unknown>>>();

    if (dineInOrderIds.length > 0) {
        const [
            { data: orderItems, error: orderItemsError },
            { data: kdsItems, error: kdsItemsError },
        ] = await Promise.all([
            db
                .from('order_items')
                .select('id, order_id, name, quantity, notes, station, modifiers, course')
                .in('order_id', dineInOrderIds),
            db
                .from('kds_order_items')
                .select(
                    'id, order_id, order_item_id, name, quantity, notes, station, status, modifiers'
                )
                .eq('restaurant_id', restaurantId)
                .in('order_id', dineInOrderIds),
        ]);

        if (!orderItemsError) {
            for (const item of (orderItems ?? []) as Array<Record<string, unknown>>) {
                const orderId = String(item.order_id ?? '');
                if (!orderId) continue;
                const bucket = orderItemsByOrder.get(orderId) ?? [];
                bucket.push(item);
                orderItemsByOrder.set(orderId, bucket);
            }
        }

        if (!kdsItemsError) {
            for (const item of (kdsItems ?? []) as Array<Record<string, unknown>>) {
                const orderId = String(item.order_id ?? '');
                if (!orderId) continue;
                const bucket = kdsItemsByOrder.get(orderId) ?? [];
                bucket.push(item);
                kdsItemsByOrder.set(orderId, bucket);
            }
        }
    }

    // Auto-hydrate missing KDS item rows for legacy orders that only have items JSON.
    const hydrationRows: Array<Record<string, unknown>> = [];
    for (const rawOrder of (dineInOrders ?? []) as Array<Record<string, unknown>>) {
        const orderId = String(rawOrder.id ?? '');
        if (!orderId) continue;
        if ((kdsItemsByOrder.get(orderId)?.length ?? 0) > 0) continue;
        if ((orderItemsByOrder.get(orderId)?.length ?? 0) > 0) continue;

        const fallbackItems = Array.isArray(rawOrder.items)
            ? (rawOrder.items as Array<Record<string, unknown>>)
            : [];
        if (fallbackItems.length === 0) continue;

        for (let idx = 0; idx < fallbackItems.length; idx += 1) {
            const item = fallbackItems[idx];
            hydrationRows.push({
                restaurant_id: restaurantId,
                order_id: orderId,
                order_item_id: null,
                station: resolveItemStation(item.station),
                status: mapOrderStatusToKdsItemStatus(String(rawOrder.status ?? 'pending')),
                name: String(item.name ?? 'Item'),
                quantity: Number(item.quantity ?? 1),
                notes: item.notes ? String(item.notes) : null,
                modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
                metadata: {
                    source: 'kds_queue_auto_hydration',
                    fallback_index: idx,
                },
            });
        }
    }

    if (hydrationRows.length > 0) {
        const hydrationBuilder = db.from('kds_order_items');
        if (typeof hydrationBuilder?.insert === 'function') {
            const { data: hydratedItems } = await hydrationBuilder
                .insert(hydrationRows as TablesInsert<'kds_order_items'>[])
                .select(
                    'id, order_id, order_item_id, name, quantity, notes, station, status, modifiers'
                );

            for (const item of (hydratedItems ?? []) as Array<Record<string, unknown>>) {
                const orderId = String(item.order_id ?? '');
                if (!orderId) continue;
                const bucket = kdsItemsByOrder.get(orderId) ?? [];
                bucket.push(item);
                kdsItemsByOrder.set(orderId, bucket);
            }
        }
    }

    for (const rawOrder of (dineInOrders ?? []) as Array<Record<string, unknown>>) {
        const createdAt = String(rawOrder.created_at ?? '');
        if (!createdAt) {
            continue;
        }

        const elapsedMinutes = calculateElapsedMinutes(createdAt);
        const slaState = resolveSlaStatus(elapsedMinutes, sla_minutes);

        const orderId = String(rawOrder.id ?? '');
        const orderItems = orderItemsByOrder.get(orderId) ?? [];
        const orderItemCourseById = new Map<string, string>();
        for (const row of orderItems) {
            const orderItemId = String(row.id ?? '');
            if (!orderItemId) continue;
            orderItemCourseById.set(orderItemId, normalizeCourse(row.course));
        }
        const kdsItems = kdsItemsByOrder.get(orderId) ?? [];

        const fallbackItems = Array.isArray(rawOrder.items)
            ? (rawOrder.items as Array<Record<string, unknown>>)
            : [];

        const normalizedItems =
            kdsItems.length > 0
                ? kdsItems.map((item, idx) => ({
                      id: String(item.id ?? `${rawOrder.id}-kds-${idx}`),
                      kds_item_id: item.id ? String(item.id) : undefined,
                      name: String(item.name ?? 'Item'),
                      quantity: Number(item.quantity ?? 1),
                      notes: item.notes ? String(item.notes) : undefined,
                      station: resolveItemStation(item.station),
                      course: normalizeCourse(
                          item.order_item_id
                              ? orderItemCourseById.get(String(item.order_item_id))
                              : undefined
                      ),
                      status: String(item.status ?? 'queued'),
                      order_item_id: item.order_item_id ? String(item.order_item_id) : undefined,
                      modifiers: Array.isArray(item.modifiers)
                          ? item.modifiers.map(mod => String(mod))
                          : undefined,
                  }))
                : orderItems.length > 0
                  ? orderItems.map((item, idx) => ({
                        id: String(item.id ?? `${rawOrder.id}-oi-${idx}`),
                        kds_item_id: undefined,
                        name: String(item.name ?? 'Item'),
                        quantity: Number(item.quantity ?? 1),
                        notes: item.notes ? String(item.notes) : undefined,
                        station: resolveItemStation(item.station),
                        course: normalizeCourse(item.course),
                        status: 'queued',
                        modifiers: Array.isArray(item.modifiers)
                            ? item.modifiers.map(mod => String(mod))
                            : undefined,
                    }))
                  : fallbackItems.map((item, idx) => ({
                        id: String(item.id ?? `${rawOrder.id}-item-${idx}`),
                        kds_item_id: undefined,
                        name: String(item.name ?? 'Item'),
                        quantity: Number(item.quantity ?? 1),
                        notes: item.notes ? String(item.notes) : undefined,
                        station: resolveItemStation(item.station),
                        course: normalizeCourse(item.course),
                        status: 'queued',
                        modifiers: Array.isArray(item.modifiers)
                            ? item.modifiers.map(mod => String(mod))
                            : undefined,
                    }));

        const visibleItems = normalizedItems.filter(item =>
            shouldIncludeItemByFireMode({
                fireMode: rawOrder.fire_mode,
                currentCourse: rawOrder.current_course,
                itemCourse: item.course,
            })
        );

        if (visibleItems.length === 0) {
            continue;
        }

        const ticketStation = resolveTicketStation(
            visibleItems.map(item => item.station ?? 'kitchen')
        );

        unified.push({
            id: String(rawOrder.id),
            source: 'dine-in',
            sourceLabel: SOURCE_CONFIG['dine-in'].label,
            sourceColor: SOURCE_CONFIG['dine-in'].color,
            orderNumber: String(rawOrder.order_number ?? rawOrder.id),
            tableNumber: rawOrder.table_number ? String(rawOrder.table_number) : undefined,
            items: visibleItems,
            station: ticketStation,
            status: String(rawOrder.status ?? 'pending'),
            priority: resolvePriority(elapsedMinutes, sla_minutes),
            createdAt,
            acknowledgedAt: rawOrder.acknowledged_at ? String(rawOrder.acknowledged_at) : undefined,
            elapsedMinutes,
            slaStatus: slaState,
            fireMode: String(rawOrder.fire_mode ?? 'auto') === 'manual' ? 'manual' : 'auto',
            currentCourse: rawOrder.current_course
                ? normalizeCourse(rawOrder.current_course)
                : null,
        });
    }

    for (const rawOrder of (externalOrders ?? []) as Array<Record<string, unknown>>) {
        const createdAt = String(rawOrder.created_at ?? '');
        if (!createdAt) {
            continue;
        }

        const payloadJson =
            rawOrder.payload_json && typeof rawOrder.payload_json === 'object'
                ? (rawOrder.payload_json as Record<string, unknown>)
                : {};
        const provider = String(rawOrder.provider ?? 'direct_delivery');

        const source =
            provider === 'custom_local'
                ? payloadJson?.fulfillment_type === 'pickup'
                    ? 'direct_pickup'
                    : 'direct_delivery'
                : provider;

        const config =
            SOURCE_CONFIG[source as keyof typeof SOURCE_CONFIG] ?? SOURCE_CONFIG['direct_delivery'];

        const elapsedMinutes = calculateElapsedMinutes(createdAt);
        const slaState = resolveSlaStatus(elapsedMinutes, sla_minutes);

        const payloadItems = Array.isArray(payloadJson.items)
            ? (payloadJson.items as Array<Record<string, unknown>>)
            : [];

        const normalizedItems = payloadItems.map((item, idx) => ({
            id: String(item.id ?? `${rawOrder.id}-ext-${idx}`),
            name: String(item.name ?? 'Item'),
            quantity: Number(item.quantity ?? 1),
            notes: item.notes ? String(item.notes) : undefined,
            station: resolveItemStation(item.station),
            modifiers: Array.isArray(item.modifiers)
                ? item.modifiers.map(mod => String(mod))
                : undefined,
        }));

        const ticketStation = resolveTicketStation(
            normalizedItems.map(item => item.station ?? 'kitchen')
        );

        unified.push({
            id: String(rawOrder.id),
            source: source as UnifiedKDSOrder['source'],
            sourceLabel: config.label,
            sourceColor: config.color,
            orderNumber: String(rawOrder.provider_order_id ?? `EXT-${rawOrder.id}`),
            customerName: payloadJson.customer_name ? String(payloadJson.customer_name) : undefined,
            items: normalizedItems,
            station: ticketStation,
            status: String(rawOrder.normalized_status ?? 'pending'),
            priority: resolvePriority(elapsedMinutes, sla_minutes),
            createdAt,
            acknowledgedAt: rawOrder.acknowledged_at ? String(rawOrder.acknowledged_at) : undefined,
            elapsedMinutes,
            slaStatus: slaState,
            externalOrderId: rawOrder.provider_order_id
                ? String(rawOrder.provider_order_id)
                : undefined,
            driverInfo:
                payloadJson.driver_info && typeof payloadJson.driver_info === 'object'
                    ? (payloadJson.driver_info as UnifiedKDSOrder['driverInfo'])
                    : undefined,
        });
    }

    const filtered = unified.filter(item => {
        if (!stationMatches(item, station as StationFilter)) return false;
        if (sla_status && item.slaStatus !== sla_status) return false;
        if (decodedCursor && !isAfterCursor(item, decodedCursor)) return false;
        return true;
    });

    filtered.sort((a, b) => {
        const aTs = new Date(a.createdAt).getTime();
        const bTs = new Date(b.createdAt).getTime();
        if (aTs !== bTs) return aTs - bTs;
        return a.id.localeCompare(b.id);
    });

    const page = filtered.slice(0, limit);
    const hasMore = filtered.length > limit;

    return apiSuccess<QueueResponse>({
        orders: page,
        total: page.length,
        summary: {
            dineIn: page.filter(o => o.source === 'dine-in').length,
            directDelivery: page.filter(o => o.source === 'direct_delivery').length,
            directPickup: page.filter(o => o.source === 'direct_pickup').length,
            partners: page.filter(o =>
                ['beu', 'zmall', 'telebirr_food', 'deliver_addis', 'esoora'].includes(o.source)
            ).length,
        },
        cursor: {
            next:
                hasMore && page.length > 0
                    ? encodeCursor({
                          createdAt: page[page.length - 1].createdAt,
                          id: page[page.length - 1].id,
                      })
                    : null,
            has_more: hasMore,
        },
        filters: {
            status: status ?? null,
            station,
            sla_status: sla_status ?? null,
            sla_minutes,
        },
        policies: {
            ready_auto_archive_minutes: readyAutoArchiveMinutes,
            auto_archived_in_this_fetch: autoArchivedCount,
        },
    });
}
