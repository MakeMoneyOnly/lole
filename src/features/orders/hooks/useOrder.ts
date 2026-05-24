'use client';

import { useQuery } from '@tanstack/react-query';
import { ordersService } from '../domain';
import type { OrderRow } from '../domain';

interface UseOrderOptions {
    orderId: string;
    enabled?: boolean;
}

export function useOrder({
    orderId,
    enabled = true,
}: UseOrderOptions): ReturnType<typeof useQuery<OrderRow | null>> {
    return useQuery({
        queryKey: ['order', orderId],
        queryFn: () => ordersService.getOrder(orderId),
        enabled: enabled && !!orderId,
    });
}
