export * from './status';
export * from './zod-schemas';
export * from './database';
export * from './db-helpers';

// Re-export models with explicit types to avoid conflicts
export type {
    Restaurant,
    Category,
    MenuItem,
    Order,
    Station,
    AgencyUser,
    ServiceRequest,
    AuditLog,
    CategoryWithItems,
    RestaurantWithMenu,
    CartItem,
    OrderItem,
    RestaurantSettings,
} from './models';

// Re-export GraphQL types for discoverability
export type {
    OrderStatus,
    OrderType,
    PaymentStatus,
    StaffRole,
} from './graphql';

// Common domain status unions for convenience
export type {
    OrderStatus as DomainOrderStatus,
    PaymentStatus as DomainPaymentStatus,
    KdsItemStatus as DomainKdsItemStatus,
    StaffRole as DomainStaffRole,
    TableSessionStatus as DomainTableSessionStatus,
    OrderItemStatus as DomainOrderItemStatus,
} from './status';
