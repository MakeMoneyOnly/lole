import { NextRequest } from 'next/server';
import { updateKDSStatusHandler } from '@/features/operations/kds/api';

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ orderId: string }> }
): Promise<Response> {
    const { orderId } = await context.params;
    return updateKDSStatusHandler(request, { orderId });
}
