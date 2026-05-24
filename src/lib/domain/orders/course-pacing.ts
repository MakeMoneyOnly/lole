export type OrderCourseName = 'appetizer' | 'main' | 'dessert' | 'beverage' | 'side';
export type OrderFireMode = 'auto' | 'manual';

export interface ResolveCoursePacingInput {
    currentStatus: string;
    existingFireMode?: OrderFireMode | null;
    existingCourse?: OrderCourseName | null;
    requestedFireMode?: OrderFireMode;
    requestedCourse?: OrderCourseName;
}

export interface ResolvedCoursePacing {
    fireMode: OrderFireMode;
    currentCourse: OrderCourseName;
    nextOrderStatus: string;
}

const COURSE_ORDER: OrderCourseName[] = ['appetizer', 'main', 'dessert', 'beverage', 'side'];

function getNextCourse(course?: OrderCourseName | null): OrderCourseName {
    if (!course) return 'appetizer';

    const currentIndex = COURSE_ORDER.indexOf(course);
    if (currentIndex === -1 || currentIndex >= COURSE_ORDER.length - 1) {
        return course;
    }

    return COURSE_ORDER[currentIndex + 1];
}

export function resolveCoursePacing(input: ResolveCoursePacingInput): ResolvedCoursePacing {
    const fireMode = input.requestedFireMode ?? input.existingFireMode ?? 'auto';
    const currentCourse =
        input.requestedCourse ??
        (fireMode === 'auto'
            ? getNextCourse(input.existingCourse)
            : (input.existingCourse ?? 'appetizer'));

    if (
        input.existingCourse &&
        input.requestedCourse &&
        COURSE_ORDER.indexOf(input.requestedCourse) < COURSE_ORDER.indexOf(input.existingCourse)
    ) {
        throw new Error('Course pacing cannot move backwards offline.');
    }

    const nextOrderStatus =
        input.currentStatus === 'pending' ? 'acknowledged' : input.currentStatus || 'acknowledged';

    return {
        fireMode,
        currentCourse,
        nextOrderStatus,
    };
}
