import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';

export async function POST(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    const body = await request.json();
    const { mood, rating } = body;

    if (!mood || !rating) {
        return apiError('Missing required fields', 400, 'MISSING_FIELDS');
    }

    // Insert the mood rating into the reviews table so it shows up in metrics
    const { error } = await context.supabase.from('reviews').insert({
        restaurant_id: context.restaurantId,
        rating: rating,
        user_name: 'Manager Check-in',
        comment: mood,
        created_at: new Date().toISOString(),
    });

    if (error) {
        return apiError('Failed to log mood', 500, 'MOOD_LOG_FAILED', error.message);
    }

    return apiSuccess({ success: true });
}
