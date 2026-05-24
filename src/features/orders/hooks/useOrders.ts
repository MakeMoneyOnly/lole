'use client';

import { useQuery } from '@tanstack/react-query';
import { ordersService } from '../domain';
import type { OrderStatus } from '@/types/status';
import type { OrderRow } from '../domain';

interface UseOrdersOptions {
    restaurantId: string;
    status?: OrderStatus;
    tableId?: string;
    enabled?: boolean;
}

export function useOrders({
    restaurantId,
    status,
    tableId,
    enabled = true,
}: UseOrdersOptions): ReturnType<typeof useQuery<OrderRow[]>> {
    return useQuery({
        queryKey: ['orders', restaurantId, status, tableId],
        queryFn: () => ordersService.getOrders(restaurantId, { status, tableId }),
        enabled: enabled && !!restaurantId,
    });
}
