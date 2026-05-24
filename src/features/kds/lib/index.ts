/**
 * Kitchen Display System Library
 * lole - Restaurant Operating System v2.0
 *
 * Core KDS utilities and smart queue management.
 */

export {
    // Core Classes
    SmartQueue,

    // Utility Functions
    formatETA,
    getPriorityColor,
    getPriorityLabel,
    isOrderOverdue,
    getCoursePriority,
    groupItemsByCourse,
    shouldStartCourse,
    calculateOrderPriority,

    // Configuration
    defaultSmartQueueConfig,
} from './smartQueue';

// Types
export type {
    CourseType,
    CustomerType,
    OrderStatus,
    StationType,
    OrderItem,
    KDSOrder,
    OrderPriority,
    StationMetrics,
    SmartQueueConfig,
} from './smartQueue';
