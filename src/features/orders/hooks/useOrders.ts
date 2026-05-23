'use client';

import { useQuery } from '@tanstack/react-query';
import { ordersService } from '../domain';
import type { OrderStatus } from '@/types/status';

interface UseOrdersOptions {
    restaurantId: string;
    status?: OrderStatus;
    tableId?: string;
    enabled?: boolean;
}

export function useOrders({ restaurantId, status, tableId, enabled = true }: UseOrdersOptions) {
    return useQuery({
        queryKey: ['orders', restaurantId, status, tableId],
        queryFn: () => ordersService.getOrders(restaurantId, { status, tableId }),
        enabled: enabled && !!restaurantId,
    });
}
