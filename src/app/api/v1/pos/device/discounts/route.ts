import { apiError, apiSuccess } from '@/lib/api/response';
import { getDeviceContext } from '@/lib/api/authz';
import { listActiveDiscountsForRestaurant } from '@/lib/discounts/service';

export async function GET(request: Request) {
    const context = await getDeviceContext(request);
    if (!context.ok) {
        return context.response;
    }

    try {
        const discounts = await listActiveDiscountsForRestaurant(
            context.admin,
            context.restaurantId
        );
        return apiSuccess({ discounts });
    } catch (error) {
        return apiError(
            'Failed to load discounts',
            500,
            'DISCOUNTS_FETCH_FAILED',
            error instanceof Error ? error.message : 'Unknown discount fetch error'
        );
    }
}
