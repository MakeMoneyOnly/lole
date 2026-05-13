import { apiError, apiSuccess } from '@/lib/api/response';
import { getScopedDeviceContext } from '@/lib/api/authz';
import { getPaymentOptionsForSurface, normalizeDeviceMetadata } from '@/lib/devices/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

const ACTIVE_ORDER_STATUSES = ['pending', 'acknowledged', 'preparing', 'ready', 'served'];

export async function GET(request: Request) {
    const ctx = await getScopedDeviceContext(request, ['terminal']);
    if (!ctx.ok) return ctx.response;

    const admin = createServiceRoleClient();
    const [tablesResult, ordersResult] = await Promise.all([
        admin
            .from('tables')
            .select('id, table_number, status, updated_at')
            .eq('restaurant_id', ctx.restaurantId)
            .order('table_number'),
        admin
            .from('orders')
            .select('id, table_number, order_number, status, total_price, created_at')
            .eq('restaurant_id', ctx.restaurantId)
            .in('status', ACTIVE_ORDER_STATUSES)
            .order('created_at', { ascending: false }),
    ]);

    if (tablesResult.error) {
        return apiError(
            'Failed to fetch terminal tables',
            500,
            'TERMINAL_TABLES_FETCH_FAILED',
            tablesResult.error.message
        );
    }

    if (ordersResult.error) {
        return apiError(
            'Failed to fetch terminal orders',
            500,
            'TERMINAL_ORDERS_FETCH_FAILED',
            ordersResult.error.message
        );
    }

    const tables = tablesResult.data ?? [];
    const orders = ordersResult.data ?? [];
    const deviceMetadata = normalizeDeviceMetadata(
        'terminal',
        (ctx.device.metadata ?? undefined) as Record<string, unknown> | undefined
    );

    const orderTotalsByTable = new Map<string, number>();
    const orderCountsByTable = new Map<string, number>();

    for (const order of orders) {
        const tableNumber = String(order.table_number ?? '').trim();
        if (!tableNumber) continue;
        orderTotalsByTable.set(
            tableNumber,
            Number(
                (
                    (orderTotalsByTable.get(tableNumber) ?? 0) + Number(order.total_price ?? 0)
                ).toFixed(2)
            )
        );
        orderCountsByTable.set(tableNumber, (orderCountsByTable.get(tableNumber) ?? 0) + 1);
    }

    const terminalTables = tables
        .filter(table => {
            const status = String(table.status ?? 'available');
            return (
                status !== 'available' || orderTotalsByTable.has(String(table.table_number ?? ''))
            );
        })
        .map(table => ({
            ...table,
            outstanding_total: orderTotalsByTable.get(String(table.table_number ?? '')) ?? 0,
            active_order_count: orderCountsByTable.get(String(table.table_number ?? '')) ?? 0,
        }));

    return apiSuccess({
        device: {
            id: ctx.device.id,
            name: ctx.device.name,
            device_type: ctx.device.device_type,
            device_profile: ctx.device.device_profile ?? 'cashier',
            assigned_zones: ctx.device.assigned_zones,
            last_active_at: ctx.device.last_active_at,
            metadata: deviceMetadata,
        },
        payment_options: getPaymentOptionsForSurface('terminal').filter(option =>
            (deviceMetadata.allowed_payment_methods ?? []).includes(option.method)
        ),
        tables: terminalTables,
        orders,
    });
}
