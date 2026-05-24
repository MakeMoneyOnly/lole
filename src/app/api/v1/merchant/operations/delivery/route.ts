import { aggregatorOrders } from '@/features/operations/delivery';

export async function POST(request: Request): Promise<Response> {
    return aggregatorOrders(request as never);
}
