import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@/types/database';
import { logger } from '@/lib/logger';

const log = logger.child('[happy-hour]');

/**
 * Happy hour schedule type definition
 */
export type HappyHourSchedule = Tables<'happy_hour_schedules'>;

/**
 * Get the day of week abbreviation for the current day
 */
function getCurrentDayAbbrev(): string {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return days[new Date().getDay()];
}

/**
 * Check if a time falls within a happy hour schedule
 */
function isTimeInRange(startTime: string, endTime: string): boolean {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

    // Handle overnight ranges (e.g., 22:00 to 02:00)
    if (endTime < startTime) {
        return currentTime >= startTime || currentTime < endTime;
    }

    return currentTime >= startTime && currentTime < endTime;
}

/**
 * Find the active happy hour for a restaurant at the current time
 */
export async function getActiveHappyHour(
    supabase: SupabaseClient<Database>,
    restaurantId: string
): Promise<HappyHourSchedule | null> {
    const currentDay = getCurrentDayAbbrev();
    const _now = new Date();

    // Get all active happy hours for this restaurant
    // HIGH-013: Explicit column selection
    const { data: schedules, error } = await supabase
        .from('happy_hour_schedules')
        .select(
            'id, restaurant_id, name, name_am, description, description_am, applies_to, schedule_days, schedule_start_time, schedule_end_time, discount_percentage, discount_fixed_amount, is_active, priority, requires_manager_pin, target_category_id, target_menu_item_ids, created_by, created_at, updated_at'
        )
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .limit(10);

    if (error || !schedules) {
        log.error('Failed to fetch happy hour schedules', error);
        return null;
    }

    for (const schedule of schedules) {
        const days = schedule.schedule_days;
        if (!days || !days.includes(currentDay)) {
            continue;
        }

        if (isTimeInRange(schedule.schedule_start_time, schedule.schedule_end_time)) {
            return schedule;
        }
    }

    return null;
}

/**
 * Calculate happy hour discount for a given amount
 */
export function calculateHappyHourDiscount(
    amount: number,
    happyHour: HappyHourSchedule
): { discount: number; finalAmount: number } {
    let discount = 0;

    if (happyHour.discount_percentage) {
        discount = Math.round(amount * (happyHour.discount_percentage / 10000));
    } else if (happyHour.discount_fixed_amount) {
        discount = Math.min(happyHour.discount_fixed_amount, amount);
    }

    return {
        discount,
        finalAmount: Math.max(0, amount - discount),
    };
}
