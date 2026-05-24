/**
 * Zod validation schemas for GraphQL inputs
 * Provides input validation for all GraphQL mutation resolvers
 */
import { z } from 'zod';

// ============================================================================
// Order Input Validation Schemas
// ============================================================================

/**
 * Schema for order item input within createOrder mutation
 */
export const OrderItemInputSchema = z.object({
    menuItemId: z.string().uuid('Invalid menu item ID'),
    quantity: z.number().int().positive().max(100, 'Quantity cannot exceed 100'),
    modifiers: z.record(z.string(), z.unknown()).optional(),
    notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
    idempotencyKey: z.string().min(1, 'Idempotency key is required'),
});

/**
 * Schema for createOrder mutation input
 */
export const CreateOrderInputSchema = z.object({
    restaurantId: z.string().uuid('Invalid restaurant ID'),
    tableId: z.string().uuid('Invalid table ID').optional(),
    type: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY'], {
        message: 'Invalid order type',
    }),
    items: z
        .array(OrderItemInputSchema)
        .min(1, 'At least one item is required')
        .max(100, 'Cannot exceed 100 items'),
    notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').optional(),
    idempotencyKey: z.string().min(1, 'Idempotency key is required'),
});

/**
 * Schema for updateOrderStatus mutation input
 */
export const UpdateOrderStatusInputSchema = z.object({
    id: z.string().uuid('Invalid order ID'),
    status: z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'], {
        message: 'Invalid order status',
    }),
});

/**
 * Schema for cancelOrder mutation input
 */
export const CancelOrderInputSchema = z.object({
    id: z.string().uuid('Invalid order ID'),
    reason: z.string().max(500, 'Reason cannot exceed 500 characters').optional(),
});

// ============================================================================
// Menu Item Input Validation Schemas
// ============================================================================

/**
 * Schema for createMenuItem mutation input
 */
export const CreateMenuItemInputSchema = z.object({
    restaurantId: z.string().uuid('Invalid restaurant ID'),
    categoryId: z.string().uuid('Invalid category ID').optional().nullable(),
    name: z.string().min(1, 'Name is required').max(200, 'Name cannot exceed 200 characters'),
    nameAm: z.string().max(200, 'Amharic name cannot exceed 200 characters').optional(),
    description: z.string().max(1000, 'Description cannot exceed 1000 characters').optional(),
    descriptionAm: z
        .string()
        .max(1000, 'Amharic description cannot exceed 1000 characters')
        .optional(),
    price: z.number().positive('Price must be positive').max(1000000, 'Price exceeds maximum'),
    isAvailable: z.boolean().optional(),
    preparationTimeMinutes: z.number().int().min(0).max(1440).optional(),
});

/**
 * Schema for updateMenuItem mutation input
 */
export const UpdateMenuItemInputSchema = z.object({
    id: z.string().uuid('Invalid menu item ID'),
    categoryId: z.string().uuid('Invalid category ID').optional().nullable(),
    name: z
        .string()
        .min(1, 'Name is required')
        .max(200, 'Name cannot exceed 200 characters')
        .optional(),
    nameAm: z.string().max(200, 'Amharic name cannot exceed 200 characters').optional(),
    description: z.string().max(1000, 'Description cannot exceed 1000 characters').optional(),
    descriptionAm: z
        .string()
        .max(1000, 'Amharic description cannot exceed 1000 characters')
        .optional(),
    price: z
        .number()
        .positive('Price must be positive')
        .max(1000000, 'Price exceeds maximum')
        .optional(),
    isAvailable: z.boolean().optional(),
    preparationTimeMinutes: z.number().int().min(0).max(1440).optional(),
});

// ============================================================================
// Guest Input Validation Schemas
// ============================================================================

/**
 * Schema for createGuest mutation input
 */
export const CreateGuestInputSchema = z.object({
    restaurantId: z.string().uuid('Invalid restaurant ID'),
    name: z.string().min(1, 'Name is required').max(200, 'Name cannot exceed 200 characters'),
    phone: z.string().max(50, 'Phone cannot exceed 50 characters').optional(),
    email: z
        .string()
        .email('Invalid email')
        .max(255, 'Email cannot exceed 255 characters')
        .optional()
        .or(z.literal('')),
    notes: z.string().max(2000, 'Notes cannot exceed 2000 characters').optional(),
    tags: z.array(z.string().max(50)).max(20, 'Cannot exceed 20 tags').optional(),
});

/**
 * Schema for updateGuest mutation input
 */
export const UpdateGuestInputSchema = z.object({
    id: z.string().uuid('Invalid guest ID'),
    name: z
        .string()
        .min(1, 'Name is required')
        .max(200, 'Name cannot exceed 200 characters')
        .optional(),
    phone: z.string().max(50, 'Phone cannot exceed 50 characters').optional(),
    email: z
        .string()
        .email('Invalid email')
        .max(255, 'Email cannot exceed 255 characters')
        .optional()
        .or(z.literal('')),
    notes: z.string().max(2000, 'Notes cannot exceed 2000 characters').optional(),
    tags: z.array(z.string().max(50)).max(20, 'Cannot exceed 20 tags').optional(),
});

// ============================================================================
// Staff Input Validation Schemas
// ============================================================================

/**
 * Schema for createStaffMember mutation input
 */
export const CreateStaffInputSchema = z.object({
    restaurantId: z.string().uuid('Invalid restaurant ID'),
    fullName: z.string().min(1, 'Name is required').max(200, 'Name cannot exceed 200 characters'),
    role: z.enum(['MANAGER', 'CHEF', 'WAITER', 'CASHIER', 'HOST', 'DELIVERY'], {
        message: 'Invalid staff role',
    }),
    phone: z.string().max(50, 'Phone cannot exceed 50 characters').optional(),
    email: z
        .string()
        .email('Invalid email')
        .max(255, 'Email cannot exceed 255 characters')
        .optional()
        .or(z.literal('')),
});

/**
 * Schema for updateStaffMember mutation input
 */
export const UpdateStaffInputSchema = z.object({
    id: z.string().uuid('Invalid staff ID'),
    fullName: z
        .string()
        .min(1, 'Name is required')
        .max(200, 'Name cannot exceed 200 characters')
        .optional(),
    role: z
        .enum(['MANAGER', 'CHEF', 'WAITER', 'CASHIER', 'HOST', 'DELIVERY'], {
            message: 'Invalid staff role',
        })
        .optional(),
    phone: z.string().max(50, 'Phone cannot exceed 50 characters').optional(),
    email: z
        .string()
        .email('Invalid email')
        .max(255, 'Email cannot exceed 255 characters')
        .optional()
        .or(z.literal('')),
});

// ============================================================================
// Payment Input Validation Schemas
// ============================================================================

/**
 * Schema for initiatePayment mutation input
 */
export const InitiatePaymentInputSchema = z.object({
    orderId: z.string().uuid('Invalid order ID'),
    method: z.enum(['CASH', 'CHAPA', 'CARD'], {
        message: 'Invalid payment method',
    }),
    amount: z.number().positive('Amount must be positive').max(10000000, 'Amount exceeds maximum'),
    idempotencyKey: z.string().min(1, 'Idempotency key is required'),
});

// ============================================================================
// Validation Helper Types and Functions
// ============================================================================

/**
 * Result type for validation operations
 */
export type ValidationResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Validates input against a Zod schema
 * Returns a structured result with either validated data or error message
 *
 * @param schema - Zod schema to validate against
 * @param input - Unknown input to validate
 * @returns ValidationResult with either success and data, or failure and error message
 */
export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown): ValidationResult<T> {
    const result = schema.safeParse(input);
    if (result.success) {
        return { success: true, data: result.data };
    }
    // Format error messages into a single string
    const errorMessage = result.error.issues.map(issue => issue.message).join(', ');
    return { success: false, error: errorMessage };
}

/**
 * Validates input and returns detailed error information
 * Useful when you need field-level error details
 *
 * @param schema - Zod schema to validate against
 * @param input - Unknown input to validate
 * @returns ValidationResult with either success and data, or failure with detailed errors
 */
export function validateInputDetailed<T>(
    schema: z.ZodSchema<T>,
    input: unknown
):
    | { success: true; data: T }
    | { success: false; errors: Array<{ field: string; message: string }> } {
    const result = schema.safeParse(input);
    if (result.success) {
        return { success: true, data: result.data };
    }
    // Format errors with field paths
    const errors = result.error.issues.map(issue => ({
        field: issue.path.join('.') || 'root',
        message: issue.message,
    }));
    return { success: false, errors };
}

// ============================================================================
// Type Exports for Validated Inputs
// ============================================================================

export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusInputSchema>;
export type CancelOrderInput = z.infer<typeof CancelOrderInputSchema>;
export type CreateMenuItemInput = z.infer<typeof CreateMenuItemInputSchema>;
export type UpdateMenuItemInput = z.infer<typeof UpdateMenuItemInputSchema>;
export type CreateGuestInput = z.infer<typeof CreateGuestInputSchema>;
export type UpdateGuestInput = z.infer<typeof UpdateGuestInputSchema>;
export type CreateStaffInput = z.infer<typeof CreateStaffInputSchema>;
export type UpdateStaffInput = z.infer<typeof UpdateStaffInputSchema>;
export type InitiatePaymentInput = z.infer<typeof InitiatePaymentInputSchema>;
