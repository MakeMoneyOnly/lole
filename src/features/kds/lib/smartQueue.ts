/**
 * Smart Queue Management System
 * lole - Restaurant Operating System v2.0
 *
 * AI-powered order prioritization, ETA calculation, and course-based routing
 * for the Kitchen Display System (KDS)
 */

import { colors } from '@/lib/constants/design-tokens';
import { logger } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type CourseType = 'appetizer' | 'main' | 'dessert' | 'beverage' | 'side';
export type CustomerType = 'vip' | 'regular' | 'new';
export type OrderStatus =
    | 'pending'
    | 'acknowledged'
    | 'preparing'
    | 'ready'
    | 'served'
    | 'cancelled';
export type StationType = 'kitchen' | 'bar' | 'service';

export interface OrderItem {
    id: string;
    name: string;
    quantity: number;
    price: number;
    station?: StationType;
    course?: CourseType;
    notes?: string;
    modifiers?: string[];
    prepTimeMinutes?: number;
    complexity?: number; // 1-5 scale
    ingredients?: string[];
    recipeId?: string;
}

export interface KDSOrder {
    id: string;
    orderNumber: string;
    tableNumber: string | number;
    status: OrderStatus;
    kitchenStatus: OrderStatus;
    barStatus: OrderStatus;
    items: OrderItem[];
    notes?: string;
    createdAt: string;
    acknowledgedAt?: string;
    startedAt?: string;
    completedAt?: string;
    customerType: CustomerType;
    priority: number;
    estimatedCompletionTime?: number; // in minutes
    courseSequence: CourseType[];
    assignedStation?: StationType;
    assignedStaffId?: string;
}

export interface OrderPriority {
    orderId: string;
    priority: number;
    estimatedTime: number; // in minutes
    factors: {
        waitTime: number; // minutes since order created
        complexity: number; // average complexity of items
        stationLoad: number; // current load at station (0-1)
        coursePosition: number; // position in course sequence
        customerType: CustomerType;
        itemCount: number;
        highPriorityModifiers: boolean;
    };
}

export interface StationMetrics {
    stationId: StationType;
    currentLoad: number; // 0-1
    activeOrders: number;
    averagePrepTime: number;
    capacity: number;
    queueLength: number;
}

export interface SmartQueueConfig {
    maxOrdersInQueue: number;
    slaMinutes: number; // Service Level Agreement - max time before auto-escalation
    autoBumpEnabled: boolean;
    courseRoutingEnabled: boolean;
    capacityThrottleEnabled: boolean;
    priorityWeights: {
        waitTime: number;
        complexity: number;
        stationLoad: number;
        coursePosition: number;
        customerType: number;
        modifiers: number;
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const defaultSmartQueueConfig: SmartQueueConfig = {
    maxOrdersInQueue: 50,
    slaMinutes: 20,
    autoBumpEnabled: true,
    courseRoutingEnabled: true,
    capacityThrottleEnabled: true,
    priorityWeights: {
        waitTime: 0.35,
        complexity: 0.15,
        stationLoad: 0.2,
        coursePosition: 0.15,
        customerType: 0.1,
        modifiers: 0.05,
    },
};

// ═══════════════════════════════════════════════════════════════════════════════
// COURSE ROUTING
// ═══════════════════════════════════════════════════════════════════════════════

const courseSequence: CourseType[] = ['appetizer', 'main', 'dessert', 'beverage', 'side'];

export function getCoursePriority(course: CourseType): number {
    return courseSequence.indexOf(course);
}

export function groupItemsByCourse(items: OrderItem[]): Map<CourseType, OrderItem[]> {
    const grouped = new Map<CourseType, OrderItem[]>();

    for (const item of items) {
        const course = item.course || 'main';
        if (!grouped.has(course)) {
            grouped.set(course, []);
        }
        grouped.get(course)!.push(item);
    }

    return grouped;
}

export function shouldStartCourse(
    course: CourseType,
    completedCourses: CourseType[],
    activeCourses: CourseType[]
): boolean {
    // Appetizers can always start
    if (course === 'appetizer') return true;

    // For mains, appetizers should be completed or in progress
    if (course === 'main') {
        const appetizersCompleted = completedCourses.includes('appetizer');
        const appetizersActive = activeCourses.includes('appetizer');
        return appetizersCompleted || !appetizersActive;
    }

    // For desserts, mains should be completed or in progress
    if (course === 'dessert') {
        const mainsCompleted = completedCourses.includes('main');
        const mainsActive = activeCourses.includes('main');
        return mainsCompleted || !mainsActive;
    }

    // Beverages and sides can be prepared anytime
    return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRIORITY CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

export function calculateOrderPriority(
    order: KDSOrder,
    stationMetrics: StationMetrics,
    config: SmartQueueConfig = defaultSmartQueueConfig
): OrderPriority {
    const now = new Date().getTime();
    const createdAt = new Date(order.createdAt).getTime();
    const waitTimeMinutes = (now - createdAt) / (1000 * 60);

    // Calculate complexity (average of items)
    const complexity =
        order.items.reduce((sum, item) => sum + (item.complexity || 3), 0) / order.items.length;

    // Course position (lower is higher priority within course sequence)
    const coursePosition = Math.min(
        ...order.items.map(item => getCoursePriority(item.course || 'main'))
    );

    // Customer type multiplier
    const customerTypeMultipliers: Record<CustomerType, number> = {
        vip: 1.5,
        regular: 1.0,
        new: 0.8,
    };

    // Check for high priority modifiers (allergies, special requests)
    const highPriorityModifiers = order.items.some(item =>
        item.modifiers?.some(mod => /allerg|urgent|asap|rush/i.test(mod))
    );

    // Calculate weighted priority score
    const weights = config.priorityWeights;

    const waitTimeScore = Math.min(waitTimeMinutes / config.slaMinutes, 1) * weights.waitTime;
    const complexityScore = (complexity / 5) * weights.complexity;
    const stationLoadScore = stationMetrics.currentLoad * weights.stationLoad;
    const courseScore = (1 - coursePosition / courseSequence.length) * weights.coursePosition;
    const customerScore =
        (customerTypeMultipliers[order.customerType] / 1.5) * weights.customerType;
    const modifierScore = highPriorityModifiers ? weights.modifiers : 0;

    const priority =
        waitTimeScore +
        complexityScore +
        stationLoadScore +
        courseScore +
        customerScore +
        modifierScore;

    // Calculate estimated completion time
    const basePrepTime = order.items.reduce((sum, item) => sum + (item.prepTimeMinutes || 10), 0);
    const loadFactor = 1 + stationMetrics.currentLoad * 0.5;
    const estimatedTime = Math.ceil(
        (basePrepTime * loadFactor) / Math.max(stationMetrics.capacity * 0.8, 1)
    );

    return {
        orderId: order.id,
        priority: Math.round(priority * 100) / 100,
        estimatedTime,
        factors: {
            waitTime: Math.round(waitTimeMinutes * 10) / 10,
            complexity: Math.round(complexity * 10) / 10,
            stationLoad: Math.round(stationMetrics.currentLoad * 100) / 100,
            coursePosition,
            customerType: order.customerType,
            itemCount: order.items.length,
            highPriorityModifiers,
        },
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SMART QUEUE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class SmartQueue {
    private orders: Map<string, KDSOrder> = new Map();
    private priorities: Map<string, OrderPriority> = new Map();
    private stationMetrics: Map<StationType, StationMetrics> = new Map();
    private config: SmartQueueConfig;
    private autoBumpInterval: NodeJS.Timeout | null = null;

    constructor(config: Partial<SmartQueueConfig> = {}) {
        this.config = { ...defaultSmartQueueConfig, ...config };
        this.initializeStationMetrics();

        if (this.config.autoBumpEnabled) {
            this.startAutoBump();
        }
    }

    private initializeStationMetrics(): void {
        const stations: StationType[] = ['kitchen', 'bar', 'service'];
        for (const station of stations) {
            this.stationMetrics.set(station, {
                stationId: station,
                currentLoad: 0,
                activeOrders: 0,
                averagePrepTime: 0,
                capacity: 10,
                queueLength: 0,
            });
        }
    }

    private startAutoBump(): void {
        this.autoBumpInterval = setInterval(() => {
            this.checkAndBumpOrders();
        }, 60000); // Check every minute
    }

    stopAutoBump(): void {
        if (this.autoBumpInterval) {
            clearInterval(this.autoBumpInterval);
            this.autoBumpInterval = null;
        }
    }

    addOrder(order: KDSOrder): void {
        if (this.orders.size >= this.config.maxOrdersInQueue) {
            logger.warn(
                `SmartQueue: Maximum queue size reached (${this.config.maxOrdersInQueue})`
            );
            return;
        }

        this.orders.set(order.id, order);
        this.recalculatePriority(order.id);
        this.updateStationMetrics();
    }

    updateOrder(orderId: string, updates: Partial<KDSOrder>): KDSOrder | null {
        const order = this.orders.get(orderId);
        if (!order) return null;

        const updatedOrder = { ...order, ...updates };
        this.orders.set(orderId, updatedOrder);
        this.recalculatePriority(orderId);
        this.updateStationMetrics();

        return updatedOrder;
    }

    removeOrder(orderId: string): boolean {
        const removed = this.orders.delete(orderId);
        this.priorities.delete(orderId);
        this.updateStationMetrics();
        return removed;
    }

    getOrder(orderId: string): KDSOrder | undefined {
        return this.orders.get(orderId);
    }

    getPriority(orderId: string): OrderPriority | undefined {
        return this.priorities.get(orderId);
    }

    getAllOrders(): KDSOrder[] {
        return Array.from(this.orders.values());
    }

    getSortedOrders(station?: StationType): KDSOrder[] {
        let orders = this.getAllOrders();

        if (station) {
            orders = orders.filter(order =>
                order.items.some(item => (item.station || 'kitchen') === station)
            );
        }

        return orders.sort((a, b) => {
            const priorityA = this.priorities.get(a.id)?.priority || 0;
            const priorityB = this.priorities.get(b.id)?.priority || 0;
            return priorityB - priorityA; // Higher priority first
        });
    }

    getOrdersByCourse(course: CourseType): KDSOrder[] {
        return this.getAllOrders().filter(order =>
            order.items.some(item => item.course === course)
        );
    }

    private recalculatePriority(orderId: string): void {
        const order = this.orders.get(orderId);
        if (!order) return;

        const station = order.assignedStation || 'kitchen';
        const metrics = this.stationMetrics.get(station) || this.stationMetrics.get('kitchen')!;

        const priority = calculateOrderPriority(order, metrics, this.config);
        this.priorities.set(orderId, priority);
    }

    recalculateAllPriorities(): void {
        for (const orderId of this.orders.keys()) {
            this.recalculatePriority(orderId);
        }
    }

    private updateStationMetrics(): void {
        const stationCounts = new Map<StationType, { count: number; totalPrepTime: number }>();

        // Initialize
        for (const station of ['kitchen', 'bar', 'service'] as StationType[]) {
            stationCounts.set(station, { count: 0, totalPrepTime: 0 });
        }

        // Count active orders by station
        for (const order of this.orders.values()) {
            if (order.status === 'preparing' || order.status === 'acknowledged') {
                for (const item of order.items) {
                    const station = item.station || 'kitchen';
                    const current = stationCounts.get(station)!;
                    current.count++;
                    current.totalPrepTime += item.prepTimeMinutes || 10;
                }
            }
        }

        // Update metrics
        for (const [stationId, data] of stationCounts) {
            const metrics = this.stationMetrics.get(stationId)!;
            metrics.activeOrders = data.count;
            metrics.queueLength = data.count;
            metrics.currentLoad = Math.min(data.count / metrics.capacity, 1);
            metrics.averagePrepTime = data.count > 0 ? data.totalPrepTime / data.count : 0;
        }
    }

    getStationMetrics(station: StationType): StationMetrics | undefined {
        return this.stationMetrics.get(station);
    }

    getAllStationMetrics(): StationMetrics[] {
        return Array.from(this.stationMetrics.values());
    }

    private checkAndBumpOrders(): void {
        const now = new Date().getTime();

        for (const [orderId, order] of this.orders) {
            const createdAt = new Date(order.createdAt).getTime();
            const waitTimeMinutes = (now - createdAt) / (1000 * 60);

            if (waitTimeMinutes > this.config.slaMinutes && order.status === 'pending') {
                // Auto-escalate order
                this.updateOrder(orderId, {
                    priority: (order.priority || 0) + 10,
                    notes: `${order.notes || ''} [AUTO-ESCALATED: Exceeded ${this.config.slaMinutes}min SLA]`.trim(),
                });
            }
        }

        this.recalculateAllPriorities();
    }

    shouldThrottleNewOrders(station: StationType): boolean {
        if (!this.config.capacityThrottleEnabled) return false;

        const metrics = this.stationMetrics.get(station);
        if (!metrics) return false;

        return metrics.currentLoad > 0.9; // Throttle at 90% capacity
    }

    getQueueStats(): {
        totalOrders: number;
        pendingCount: number;
        preparingCount: number;
        readyCount: number;
        averageWaitTime: number;
        averagePriority: number;
    } {
        const orders = this.getAllOrders();
        const now = new Date().getTime();

        let totalWaitTime = 0;
        let totalPriority = 0;

        for (const order of orders) {
            const createdAt = new Date(order.createdAt).getTime();
            totalWaitTime += (now - createdAt) / (1000 * 60);
            totalPriority += this.priorities.get(order.id)?.priority || 0;
        }

        return {
            totalOrders: orders.length,
            pendingCount: orders.filter(o => o.status === 'pending').length,
            preparingCount: orders.filter(o => o.status === 'preparing').length,
            readyCount: orders.filter(o => o.status === 'ready').length,
            averageWaitTime: orders.length > 0 ? totalWaitTime / orders.length : 0,
            averagePriority: orders.length > 0 ? totalPriority / orders.length : 0,
        };
    }

    dispose(): void {
        this.stopAutoBump();
        this.orders.clear();
        this.priorities.clear();
        this.stationMetrics.clear();
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function formatETA(minutes: number): string {
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${Math.ceil(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.ceil(minutes % 60);
    return `${hours}h ${mins}m`;
}

export function getPriorityColor(priority: number): string {
    if (priority >= 0.8) return colors.semantic.error.DEFAULT;
    if (priority >= 0.6) return colors.semantic.warning.DEFAULT;
    if (priority >= 0.4) return colors.kds.preparing.DEFAULT;
    return colors.semantic.success.DEFAULT;
}

export function getPriorityLabel(priority: number): string {
    if (priority >= 0.8) return 'Critical';
    if (priority >= 0.6) return 'High';
    if (priority >= 0.4) return 'Medium';
    return 'Normal';
}

export function isOrderOverdue(order: KDSOrder, slaMinutes: number = 20): boolean {
    const createdAt = new Date(order.createdAt).getTime();
    const now = new Date().getTime();
    const waitTimeMinutes = (now - createdAt) / (1000 * 60);
    return waitTimeMinutes > slaMinutes;
}

export default SmartQueue;
