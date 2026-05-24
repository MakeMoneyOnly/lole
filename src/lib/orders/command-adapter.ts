import {
    getPowerSync,
    updateOfflineOrderCourseFire,
    updateOfflineOrderStatus,
    type OfflineOrderStatus,
} from '@/lib/sync';

export type SubmitOrderCommandMode = 'local';
type OrderCourse = 'appetizer' | 'main' | 'dessert' | 'beverage' | 'side';

export interface SubmitOrderStatusInput {
    orderId: string;
    status: OfflineOrderStatus;
}

export interface SubmitOrderCourseFireInput {
    orderId: string;
    fireMode?: 'auto' | 'manual';
    currentCourse?: OrderCourse;
}

export interface SubmitOrderCommandResult {
    ok: boolean;
    mode?: SubmitOrderCommandMode;
    error?: string;
}

function hasLocalRuntime(): boolean {
    return getPowerSync() !== null;
}

const LOCAL_RUNTIME_UNAVAILABLE_ERROR =
    'Local order command runtime unavailable. Pair to store gateway and retry.';

export async function submitOrderStatusUpdate(
    input: SubmitOrderStatusInput
): Promise<SubmitOrderCommandResult> {
    if (!hasLocalRuntime()) {
        return { ok: false, error: LOCAL_RUNTIME_UNAVAILABLE_ERROR };
    }

    try {
        const updated = await updateOfflineOrderStatus(input.orderId, input.status);
        if (updated) {
            return { ok: true, mode: 'local' };
        }
        return { ok: false, error: 'Failed to update order status locally.' };
    } catch {
        return { ok: false, error: 'Failed to update order status locally.' };
    }
}

export async function submitOrderCourseFireUpdate(
    input: SubmitOrderCourseFireInput
): Promise<SubmitOrderCommandResult> {
    if (!hasLocalRuntime()) {
        return { ok: false, error: LOCAL_RUNTIME_UNAVAILABLE_ERROR };
    }

    try {
        const updated = await updateOfflineOrderCourseFire(input.orderId, {
            fire_mode: input.fireMode,
            current_course: input.currentCourse,
        });
        if (updated) {
            return { ok: true, mode: 'local' };
        }
        return { ok: false, error: 'Failed to advance course locally.' };
    } catch {
        return { ok: false, error: 'Failed to advance course locally.' };
    }
}
