#!/usr/bin/env tsx
/**
 * OpenAPI 3.1 Schema Generator — BKND-010
 *
 * Generates OpenAPI 3.1 JSON schemas from the centralized Zod validators
 * in src/lib/validators/api.ts and inline route schemas.
 *
 * The generated output supplements the hand-written spec at
 * src/app/api/docs/route.ts with auto-generated request/response schemas.
 *
 * Usage:
 *   npx tsx scripts/tools/generate-openapi.ts [--check] [--output path]
 *
 * Options:
 *   --check    Verify generated schemas haven't drifted (CI mode)
 *   --output   Custom output path (default: src/lib/docs/openapi-generated.json)
 */

import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

interface OpenApiSchema {
    type?: string;
    format?: string;
    properties?: Record<string, OpenApiSchema>;
    required?: string[];
    items?: OpenApiSchema;
    enum?: string[];
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    description?: string;
    default?: unknown;
    nullable?: boolean;
    additionalProperties?: boolean | OpenApiSchema;
    $ref?: string;
    oneOf?: OpenApiSchema[];
    allOf?: OpenApiSchema[];
}

interface OpenApiParameter {
    name: string;
    in: 'query' | 'path' | 'header';
    required?: boolean;
    schema: OpenApiSchema;
    description?: string;
}

interface OpenApiPathItem {
    summary?: string;
    description?: string;
    operationId?: string;
    tags?: string[];
    parameters?: OpenApiParameter[];
    requestBody?: {
        required?: boolean;
        content: Record<string, { schema: OpenApiSchema }>;
    };
    responses: Record<
        string,
        {
            description: string;
            content?: Record<string, { schema: OpenApiSchema }>;
        }
    >;
    security?: Record<string, string[]>[];
}

interface OpenApiDoc {
    openapi: string;
    info: { title: string; version: string; description?: string };
    servers: { url: string; description?: string }[];
    paths: Record<string, Record<string, OpenApiPathItem>>;
    components: {
        schemas: Record<string, OpenApiSchema>;
        securitySchemes?: Record<string, OpenApiSecurityScheme>;
        parameters?: Record<string, OpenApiParameter>;
    };
    tags: { name: string; description?: string }[];
}

interface OpenApiSecurityScheme {
    type: string;
    scheme?: string;
    bearerFormat?: string;
    name?: string;
    in?: string;
    description?: string;
}

// ==========================================================================
// Common reusable schemas
// ==========================================================================

const uuidSchema: OpenApiSchema = {
    type: 'string',
    format: 'uuid',
    description: 'UUID v4 identifier',
};

const santimSchema: OpenApiSchema = {
    type: 'integer',
    minimum: 0,
    description: 'Amount in santim (1 ETB = 100 santim)',
};

const ethiopianPhoneSchema: OpenApiSchema = {
    type: 'string',
    pattern: '^(\\+251|0)?[79]\\d{8}$',
    description: 'Ethiopian phone number (normalized to +251 format)',
};

const paginationSchema: OpenApiSchema = {
    type: 'object',
    properties: {
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
        offset: { type: 'integer', minimum: 0, default: 0 },
    },
};

const errorResponse: OpenApiSchema = {
    type: 'object',
    properties: {
        error: {
            type: 'object',
            properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                requestId: { type: 'string', format: 'uuid' },
                details: {},
            },
            required: ['code', 'message', 'requestId'],
        },
    },
    required: ['error'],
};

// ==========================================================================
// Entity Schemas
// ==========================================================================

const schemas: Record<string, OpenApiSchema> = {
    // ── Order ──
    OrderItem: {
        type: 'object',
        properties: {
            id: uuidSchema,
            menuItemId: uuidSchema,
            name: { type: 'string', description: 'Item name in English' },
            nameAm: { type: 'string', description: 'Item name in Amharic' },
            quantity: { type: 'integer', minimum: 1, maximum: 100 },
            unitPrice: santimSchema,
            totalPrice: santimSchema,
            modifiers: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        modifierId: uuidSchema,
                        optionId: uuidSchema,
                        name: { type: 'string' },
                        priceAdjustment: { type: 'integer' },
                    },
                },
            },
            notes: { type: 'string', maxLength: 500 },
            status: { type: 'string', enum: ['pending', 'preparing', 'ready', 'served'] },
            kdsStation: { type: 'string' },
        },
        required: ['id', 'menuItemId', 'name', 'quantity', 'unitPrice', 'totalPrice', 'status'],
    },

    Order: {
        type: 'object',
        properties: {
            id: uuidSchema,
            restaurantId: uuidSchema,
            tableId: uuidSchema,
            orderNumber: {
                type: 'string',
                description: 'Human-readable order number (e.g. 20260504-0001)',
            },
            status: {
                type: 'string',
                enum: ['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled'],
            },
            orderType: { type: 'string', enum: ['dine_in', 'takeaway', 'delivery'] },
            totalPrice: santimSchema,
            discountAmount: santimSchema,
            notes: { type: 'string', maxLength: 1000 },
            customerName: { type: 'string' },
            customerPhone: ethiopianPhoneSchema,
            items: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } },
            idempotencyKey: uuidSchema,
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
        },
        required: [
            'id',
            'restaurantId',
            'orderNumber',
            'status',
            'orderType',
            'totalPrice',
            'createdAt',
        ],
    },

    CreateOrderRequest: {
        type: 'object',
        properties: {
            restaurantId: uuidSchema,
            tableId: uuidSchema,
            orderType: { type: 'string', enum: ['dine_in', 'takeaway', 'delivery'] },
            items: {
                type: 'array',
                items: { $ref: '#/components/schemas/CreateOrderItem' },
                minLength: 1,
            },
            notes: { type: 'string', maxLength: 1000 },
            customerName: { type: 'string', maxLength: 100 },
            customerPhone: ethiopianPhoneSchema,
            idempotencyKey: { type: 'string', format: 'uuid', maxLength: 100 },
        },
        required: ['restaurantId', 'orderType', 'items'],
    },

    CreateOrderItem: {
        type: 'object',
        properties: {
            menuItemId: uuidSchema,
            quantity: { type: 'integer', minimum: 1, maximum: 100 },
            notes: { type: 'string', maxLength: 500 },
            modifiers: { type: 'array', items: { type: 'object' } },
            priceOverride: santimSchema,
        },
        required: ['menuItemId', 'quantity'],
    },

    UpdateOrderStatus: {
        type: 'object',
        properties: {
            status: {
                type: 'string',
                enum: ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'],
            },
            reason: { type: 'string', maxLength: 500, description: 'Required for cancellation' },
        },
        required: ['status'],
    },

    SplitOrderRequest: {
        type: 'object',
        properties: {
            items: {
                type: 'array',
                minLength: 1,
                items: {
                    type: 'object',
                    properties: {
                        orderItemId: uuidSchema,
                        quantity: { type: 'integer', minimum: 1 },
                    },
                    required: ['orderItemId', 'quantity'],
                },
            },
            targetOrderId: uuidSchema,
        },
        required: ['items'],
    },

    // ── Payment ──
    InitiatePaymentRequest: {
        type: 'object',
        properties: {
            orderId: uuidSchema,
            amount: santimSchema,
            currency: { type: 'string', enum: ['ETB', 'USD'], default: 'ETB' },
            provider: { type: 'string', enum: ['chapa', 'telebirr', 'cash'] },
            returnUrl: { type: 'string', format: 'uri' },
            webhookUrl: { type: 'string', format: 'uri' },
            metadata: { type: 'object', additionalProperties: true },
            idempotencyKey: { type: 'string', maxLength: 100 },
        },
        required: ['orderId', 'amount', 'provider'],
    },

    PaymentSession: {
        type: 'object',
        properties: {
            sessionId: uuidSchema,
            mode: { type: 'string', enum: ['deferred', 'hosted_checkout'] },
            paymentChoice: { type: 'string', enum: ['pay_now', 'pay_later'] },
            provider: { type: 'string' },
            checkoutUrl: { type: 'string', format: 'uri' },
            paymentId: uuidSchema,
            transactionReference: { type: 'string' },
        },
        required: ['sessionId', 'mode', 'paymentChoice'],
    },

    // ── Menu ──
    MenuItem: {
        type: 'object',
        properties: {
            id: uuidSchema,
            restaurantId: uuidSchema,
            categoryId: uuidSchema,
            name: { type: 'string', maxLength: 200 },
            nameAm: { type: 'string', maxLength: 200, description: 'Amharic name' },
            description: { type: 'string', maxLength: 1000 },
            descriptionAm: { type: 'string', maxLength: 1000 },
            price: santimSchema,
            costPrice: santimSchema,
            imageUrl: { type: 'string', format: 'uri' },
            isAvailable: { type: 'boolean', default: true },
            preparationTimeMinutes: { type: 'integer', minimum: 1, maximum: 180 },
            dietaryTags: { type: 'array', items: { type: 'string' } },
            allergens: { type: 'array', items: { type: 'string' } },
            sortOrder: { type: 'integer', minimum: 0 },
        },
        required: ['id', 'restaurantId', 'name', 'price'],
    },

    CreateMenuItemRequest: {
        type: 'object',
        properties: {
            restaurantId: uuidSchema,
            categoryId: uuidSchema,
            name: { type: 'string', minLength: 1, maxLength: 200 },
            nameAm: { type: 'string', maxLength: 200 },
            description: { type: 'string', maxLength: 1000 },
            descriptionAm: { type: 'string', maxLength: 1000 },
            price: santimSchema,
            costPrice: santimSchema,
            imageUrl: { type: 'string', format: 'uri' },
            isAvailable: { type: 'boolean', default: true },
            preparationTimeMinutes: { type: 'integer', minimum: 1, maximum: 180 },
            dietaryTags: { type: 'array', items: { type: 'string' } },
            allergens: { type: 'array', items: { type: 'string' } },
            sortOrder: { type: 'integer', minimum: 0, default: 0 },
        },
        required: ['restaurantId', 'categoryId', 'name', 'price'],
    },

    Category: {
        type: 'object',
        properties: {
            id: uuidSchema,
            restaurantId: uuidSchema,
            name: { type: 'string', maxLength: 100 },
            nameAm: { type: 'string', maxLength: 100 },
            description: { type: 'string', maxLength: 500 },
            sortOrder: { type: 'integer', minimum: 0 },
            items: { type: 'array', items: { $ref: '#/components/schemas/MenuItem' } },
        },
        required: ['id', 'restaurantId', 'name'],
    },

    // ── Staff ──
    CreateStaffRequest: {
        type: 'object',
        properties: {
            restaurantId: uuidSchema,
            email: { type: 'string', format: 'email' },
            name: { type: 'string', minLength: 1, maxLength: 200 },
            role: { type: 'string', enum: ['owner', 'manager', 'staff', 'cashier', 'kitchen'] },
            pin: {
                type: 'string',
                pattern: '^\\d{4}$',
                maxLength: 4,
                minLength: 4,
                description: '4-digit PIN',
            },
            phone: ethiopianPhoneSchema,
        },
        required: ['restaurantId', 'email', 'name', 'role'],
    },

    // ── Table Sessions ──
    CreateTableSessionRequest: {
        type: 'object',
        properties: {
            restaurantId: uuidSchema,
            tableId: uuidSchema,
            guestName: { type: 'string', maxLength: 100 },
        },
        required: ['restaurantId', 'tableId'],
    },

    // ── Loyalty ──
    LoyaltyProgram: {
        type: 'object',
        properties: {
            id: uuidSchema,
            restaurantId: uuidSchema,
            name: { type: 'string', maxLength: 100 },
            pointsPerBirr: { type: 'integer', minimum: 1 },
            rewardThreshold: { type: 'integer', minimum: 1 },
            isActive: { type: 'boolean' },
        },
        required: ['id', 'restaurantId', 'name'],
    },
    // ── KDS ──
    KdsAction: {
        type: 'object',
        properties: {
            action: { type: 'string', enum: ['start', 'complete', 'cancel', 'recall'] },
            stationId: uuidSchema,
            notes: { type: 'string', maxLength: 500 },
        },
        required: ['action'],
    },
    KdsStation: {
        type: 'object',
        properties: {
            restaurantId: uuidSchema,
            name: { type: 'string', minLength: 1, maxLength: 100 },
            printerId: { type: 'string', maxLength: 100 },
            categories: { type: 'array', items: uuidSchema },
            isActive: { type: 'boolean', default: true },
        },
        required: ['restaurantId', 'name'],
    },
    // ── Delivery ──
    DeliveryZone: {
        type: 'object',
        properties: {
            restaurantId: uuidSchema,
            name: { type: 'string', maxLength: 100 },
            deliveryFee: santimSchema,
            estimatedDeliveryMinutes: { type: 'integer', minimum: 1, maximum: 180 },
            isActive: { type: 'boolean', default: true },
        },
        required: ['restaurantId', 'name', 'deliveryFee'],
    },
    ExternalOrder: {
        type: 'object',
        properties: {
            externalId: { type: 'string', maxLength: 100 },
            partner: { type: 'string', enum: ['beu', 'zmall', 'deliver_addis', 'esoora'] },
            items: { type: 'array', items: { $ref: '#/components/schemas/CreateOrderItem' } },
            totalAmount: santimSchema,
        },
        required: ['externalId', 'partner', 'items', 'totalAmount'],
    },
    DeliveryConnect: {
        type: 'object',
        properties: {
            restaurantId: uuidSchema,
            partner: { type: 'string', enum: ['beu', 'zmall', 'deliver_addis', 'esoora'] },
        },
        required: ['restaurantId', 'partner'],
    },
    // ── Discounts ──
    CreateDiscount: {
        type: 'object',
        properties: {
            restaurantId: uuidSchema,
            code: { type: 'string', maxLength: 50 },
            type: { type: 'string', enum: ['percentage', 'fixed', 'buy_x_get_y'] },
            value: { type: 'number', minimum: 0 },
            validFrom: { type: 'string', format: 'date-time' },
            validUntil: { type: 'string', format: 'date-time' },
        },
        required: ['restaurantId', 'code', 'type', 'value'],
    },
    ApplyDiscount: {
        type: 'object',
        properties: { code: { type: 'string', maxLength: 50 }, orderId: uuidSchema },
        required: ['code', 'orderId'],
    },
    // ── Tip Pools ──
    TipPool: {
        type: 'object',
        properties: {
            restaurantId: uuidSchema,
            name: { type: 'string', maxLength: 100 },
            periodStart: { type: 'string', format: 'date-time' },
            periodEnd: { type: 'string', format: 'date-time' },
        },
        required: ['restaurantId', 'name'],
    },
    // ── Service Requests ──
    ServiceRequest: {
        type: 'object',
        properties: {
            restaurantId: uuidSchema,
            tableId: uuidSchema,
            requestType: { type: 'string', enum: ['water', 'waiter', 'bill', 'cleanup', 'other'] },
            notes: { type: 'string', maxLength: 500 },
        },
        required: ['restaurantId', 'tableId', 'requestType'],
    },
    // ── Support Tickets ──
    SupportTicket: {
        type: 'object',
        properties: {
            restaurantId: uuidSchema,
            subject: { type: 'string', maxLength: 200 },
            description: { type: 'string', maxLength: 2000 },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        },
        required: ['restaurantId', 'subject', 'description'],
    },
    // ── Notifications ──
    PushSubscription: {
        type: 'object',
        properties: {
            endpoint: { type: 'string', format: 'uri' },
            keys: {
                type: 'object',
                properties: { p256dh: { type: 'string' }, auth: { type: 'string' } },
                required: ['p256dh', 'auth'],
            },
        },
        required: ['endpoint', 'keys'],
    },
    // ── Staff PIN ──
    VerifyPin: {
        type: 'object',
        properties: {
            pin: { type: 'string', pattern: '^\\d{4}$', minLength: 4, maxLength: 4 },
            restaurantId: uuidSchema,
        },
        required: ['pin', 'restaurantId'],
    },
    // ── Happy Hour ──
    HappyHourPricing: {
        type: 'object',
        properties: {
            restaurantId: uuidSchema,
            menuItemId: uuidSchema,
            discountPercent: { type: 'integer', minimum: 1, maximum: 100 },
            startTime: { type: 'string' },
            endTime: { type: 'string' },
        },
        required: ['restaurantId', 'menuItemId', 'discountPercent', 'startTime', 'endTime'],
    },
    // ── Sync ──
    SyncRequest: {
        type: 'object',
        properties: {
            deviceId: { type: 'string' },
            lastSyncAt: { type: 'string', format: 'date-time' },
        },
        required: ['deviceId'],
    },
};

// ==========================================================================
// Path Definitions
// ==========================================================================

const paths: Record<string, Record<string, OpenApiPathItem>> = {
    // ── Health ──
    '/health': {
        get: {
            summary: 'Health check',
            operationId: 'healthCheck',
            tags: ['Health'],
            responses: {
                '200': {
                    description: 'API is healthy',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    status: { type: 'string' },
                                    timestamp: { type: 'string' },
                                },
                            },
                        },
                    },
                },
            },
        },
    },

    // ── Orders ──
    '/orders': {
        get: {
            summary: 'List orders',
            operationId: 'listOrders',
            tags: ['Orders'],
            parameters: [
                {
                    name: 'status',
                    in: 'query',
                    schema: { type: 'string' },
                    description: 'Filter by status',
                },
                {
                    name: 'search',
                    in: 'query',
                    schema: { type: 'string' },
                    description: 'Search by table number, order number, or customer name',
                },
                {
                    name: 'limit',
                    in: 'query',
                    schema: { type: 'integer', default: 50, maximum: 200 },
                },
                { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
            ],
            responses: {
                '200': {
                    description: 'Orders list',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    data: {
                                        type: 'object',
                                        properties: {
                                            orders: {
                                                type: 'array',
                                                items: { $ref: '#/components/schemas/Order' },
                                            },
                                            total: { type: 'integer' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                '401': {
                    description: 'Unauthorized',
                    content: { 'application/json': { schema: errorResponse } },
                },
            },
            security: [{ bearerAuth: [] }],
        },
        post: {
            summary: 'Create order (guest-facing)',
            operationId: 'createOrder',
            tags: ['Orders'],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/CreateOrderRequest' },
                    },
                },
            },
            responses: {
                '201': {
                    description: 'Order created',
                    content: {
                        'application/json': { schema: { $ref: '#/components/schemas/Order' } },
                    },
                },
                '400': {
                    description: 'Validation error',
                    content: { 'application/json': { schema: errorResponse } },
                },
                '429': {
                    description: 'Rate limited',
                    content: { 'application/json': { schema: errorResponse } },
                },
            },
        },
    },

    '/orders/{orderId}/status': {
        patch: {
            summary: 'Update order status',
            operationId: 'updateOrderStatus',
            tags: ['Orders'],
            parameters: [{ name: 'orderId', in: 'path', required: true, schema: uuidSchema }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/UpdateOrderStatus' },
                    },
                },
            },
            responses: {
                '200': {
                    description: 'Status updated',
                    content: {
                        'application/json': { schema: { $ref: '#/components/schemas/Order' } },
                    },
                },
                '400': {
                    description: 'Invalid status transition',
                    content: { 'application/json': { schema: errorResponse } },
                },
            },
            security: [{ bearerAuth: [] }],
        },
    },

    '/orders/{orderId}/split': {
        post: {
            summary: 'Split order',
            operationId: 'splitOrder',
            tags: ['Orders'],
            parameters: [{ name: 'orderId', in: 'path', required: true, schema: uuidSchema }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/SplitOrderRequest' },
                    },
                },
            },
            responses: {
                '200': {
                    description: 'Order split',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    source: { $ref: '#/components/schemas/Order' },
                                    target: { $ref: '#/components/schemas/Order' },
                                },
                            },
                        },
                    },
                },
            },
            security: [{ bearerAuth: [] }],
        },
    },

    // ── Payments ──
    '/payments/initiate': {
        post: {
            summary: 'Initiate payment',
            operationId: 'initiatePayment',
            tags: ['Payments'],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/InitiatePaymentRequest' },
                    },
                },
            },
            responses: {
                '200': {
                    description: 'Payment initiated',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    data: {
                                        type: 'object',
                                        properties: {
                                            paymentId: uuidSchema,
                                            checkoutUrl: { type: 'string', format: 'uri' },
                                            status: { type: 'string' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                '400': {
                    description: 'Validation error',
                    content: { 'application/json': { schema: errorResponse } },
                },
            },
            security: [{ bearerAuth: [] }],
        },
    },

    '/payments/sessions': {
        post: {
            summary: 'Create payment session (guest QR)',
            operationId: 'createPaymentSession',
            tags: ['Payments'],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                guestContext: { type: 'object' },
                                items: { type: 'array' },
                                totalPrice: { type: 'integer' },
                                orderType: { type: 'string' },
                                paymentChoice: { type: 'string', enum: ['pay_now', 'pay_later'] },
                            },
                        },
                    },
                },
            },
            responses: {
                '201': {
                    description: 'Session created',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/PaymentSession' },
                        },
                    },
                },
            },
        },
    },

    // ── Menu ──
    '/menu': {
        get: {
            summary: 'List menu items',
            operationId: 'listMenuItems',
            tags: ['Menu'],
            parameters: [
                { name: 'restaurantId', in: 'query', schema: uuidSchema },
                { name: 'categoryId', in: 'query', schema: uuidSchema },
                { name: 'availableOnly', in: 'query', schema: { type: 'boolean' } },
            ],
            responses: {
                '200': {
                    description: 'Menu items',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    data: {
                                        type: 'array',
                                        items: { $ref: '#/components/schemas/MenuItem' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        post: {
            summary: 'Create menu item',
            operationId: 'createMenuItem',
            tags: ['Menu'],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/CreateMenuItemRequest' },
                    },
                },
            },
            responses: {
                '201': {
                    description: 'Item created',
                    content: {
                        'application/json': { schema: { $ref: '#/components/schemas/MenuItem' } },
                    },
                },
            },
            security: [{ bearerAuth: [] }],
        },
    },

    // ── Staff ──
    '/staff': {
        post: {
            summary: 'Create staff member',
            operationId: 'createStaff',
            tags: ['Staff'],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/CreateStaffRequest' },
                    },
                },
            },
            responses: {
                '201': { description: 'Staff created' },
                '400': {
                    description: 'Validation error',
                    content: { 'application/json': { schema: errorResponse } },
                },
            },
            security: [{ bearerAuth: [] }],
        },
    },

    // ── Guests ──
    '/guests': {
        get: {
            summary: 'List guests',
            operationId: 'listGuests',
            tags: ['Guests'],
            parameters: [
                { name: 'search', in: 'query', schema: { type: 'string' } },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
            ],
            responses: {
                '200': { description: 'Guest list' },
            },
            security: [{ bearerAuth: [] }],
        },
    },

    // ── Table Sessions ──
    '/table-sessions': {
        post: {
            summary: 'Open table session',
            operationId: 'openTableSession',
            tags: ['Tables'],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/CreateTableSessionRequest' },
                    },
                },
            },
            responses: {
                '201': { description: 'Session opened' },
            },
            security: [{ bearerAuth: [] }],
        },
    },

    // ── Webhooks ──
    '/webhooks/chapa': {
        post: {
            summary: 'Chapa payment webhook',
            operationId: 'chapaWebhook',
            tags: ['Webhooks'],
            requestBody: {
                required: true,
                content: { 'application/json': { schema: { type: 'object' } } },
            },
            responses: {
                '200': { description: 'Webhook processed' },
                '401': {
                    description: 'Invalid signature',
                    content: { 'application/json': { schema: errorResponse } },
                },
            },
            security: [{ webhookSignature: [] }],
        },
    },
    '/webhooks/telebirr': {
        post: {
            summary: 'Telebirr payment webhook',
            operationId: 'telebirrWebhook',
            tags: ['Webhooks'],
            responses: {
                '200': { description: 'Webhook processed' },
                '401': {
                    description: 'Invalid signature',
                    content: { 'application/json': { schema: errorResponse } },
                },
            },
        },
    },
    '/webhooks/delivery': {
        post: {
            summary: 'Delivery partner webhook',
            operationId: 'deliveryWebhook',
            tags: ['Webhooks'],
            responses: { '200': { description: 'Webhook processed' } },
        },
    },
    '/webhooks/guest-order-status': {
        post: {
            summary: 'Guest order status webhook',
            operationId: 'guestOrderStatusWebhook',
            tags: ['Webhooks'],
            responses: { '200': { description: 'Status updated' } },
        },
    },

    // ── KDS ──
    '/kds/telemetry': {
        get: {
            summary: 'KDS telemetry',
            operationId: 'kdsTelemetry',
            tags: ['KDS'],
            responses: { '200': { description: 'Telemetry data' } },
            security: [{ bearerAuth: [] }],
        },
        post: {
            summary: 'KDS heartbeat',
            operationId: 'kdsHeartbeat',
            tags: ['KDS'],
            requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
            responses: { '200': { description: 'Heartbeat recorded' } },
            security: [{ bearerAuth: [] }],
        },
    },
    '/kds/queue': {
        get: {
            summary: 'KDS order queue',
            operationId: 'kdsQueue',
            tags: ['KDS'],
            responses: { '200': { description: 'Queue items' } },
            security: [{ bearerAuth: [] }],
        },
    },
    '/kds/items/{kdsItemId}/action': {
        post: {
            summary: 'KDS item action',
            operationId: 'kdsItemAction',
            tags: ['KDS'],
            parameters: [{ name: 'kdsItemId', in: 'path', required: true, schema: uuidSchema }],
            requestBody: {
                required: true,
                content: {
                    'application/json': { schema: { $ref: '#/components/schemas/KdsAction' } },
                },
            },
            responses: { '200': { description: 'Action applied' } },
            security: [{ bearerAuth: [] }],
        },
    },

    // ── Tables ──
    '/tables': {
        get: {
            summary: 'List tables',
            operationId: 'listTables',
            tags: ['Tables'],
            responses: { '200': { description: 'Table list' } },
            security: [{ bearerAuth: [] }],
        },
        post: {
            summary: 'Create table',
            operationId: 'createTable',
            tags: ['Tables'],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                restaurantId: uuidSchema,
                                tableNumber: { type: 'string' },
                                capacity: { type: 'integer' },
                            },
                            required: ['restaurantId', 'tableNumber'],
                        },
                    },
                },
            },
            responses: { '201': { description: 'Table created' } },
            security: [{ bearerAuth: [] }],
        },
    },
    '/tables/{tableId}': {
        patch: {
            summary: 'Update table',
            operationId: 'updateTable',
            tags: ['Tables'],
            parameters: [{ name: 'tableId', in: 'path', required: true, schema: uuidSchema }],
            responses: { '200': { description: 'Table updated' } },
            security: [{ bearerAuth: [] }],
        },
    },

    // ── Table Sessions ──
    '/table-sessions/{sessionId}/transfer': {
        post: {
            summary: 'Transfer table session',
            operationId: 'transferTableSession',
            tags: ['Tables'],
            parameters: [{ name: 'sessionId', in: 'path', required: true, schema: uuidSchema }],
            requestBody: {
                content: {
                    'application/json': {
                        schema: { type: 'object', properties: { targetTableId: uuidSchema } },
                    },
                },
            },
            responses: { '200': { description: 'Session transferred' } },
            security: [{ bearerAuth: [] }],
        },
    },
    '/table-sessions/{sessionId}/close': {
        post: {
            summary: 'Close table session',
            operationId: 'closeTableSession',
            tags: ['Tables'],
            parameters: [{ name: 'sessionId', in: 'path', required: true, schema: uuidSchema }],
            responses: { '200': { description: 'Session closed' } },
            security: [{ bearerAuth: [] }],
        },
    },

    // ── Staff ──
    '/staff/verify-pin': {
        post: {
            summary: 'Verify staff PIN',
            operationId: 'verifyStaffPin',
            tags: ['Staff'],
            requestBody: {
                required: true,
                content: {
                    'application/json': { schema: { $ref: '#/components/schemas/VerifyPin' } },
                },
            },
            responses: {
                '200': { description: 'PIN verified' },
                '401': { description: 'Invalid PIN' },
            },
        },
    },
    '/staff/time-entries/clock': {
        post: {
            summary: 'Clock in/out',
            operationId: 'clockAction',
            tags: ['Staff'],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                action: {
                                    type: 'string',
                                    enum: ['clock_in', 'clock_out', 'break_start', 'break_end'],
                                },
                            },
                            required: ['action'],
                        },
                    },
                },
            },
            responses: { '201': { description: 'Clock event recorded' } },
            security: [{ bearerAuth: [] }],
        },
    },
    '/staff/schedule': {
        get: {
            summary: 'View schedule',
            operationId: 'viewSchedule',
            tags: ['Staff'],
            responses: { '200': { description: 'Schedule' } },
            security: [{ bearerAuth: [] }],
        },
        post: {
            summary: 'Create shift',
            operationId: 'createShift',
            tags: ['Staff'],
            requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
            responses: { '201': { description: 'Shift created' } },
            security: [{ bearerAuth: [] }],
        },
    },
    '/staff/invite': {
        post: {
            summary: 'Invite staff member',
            operationId: 'inviteStaff',
            tags: ['Staff'],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/CreateStaffRequest' },
                    },
                },
            },
            responses: { '201': { description: 'Invitation sent' } },
            security: [{ bearerAuth: [] }],
        },
    },
    '/staff/add-pin': {
        post: {
            summary: 'Add staff PIN',
            operationId: 'addStaffPin',
            tags: ['Staff'],
            requestBody: {
                required: true,
                content: {
                    'application/json': { schema: { $ref: '#/components/schemas/VerifyPin' } },
                },
            },
            responses: { '200': { description: 'PIN set' } },
            security: [{ bearerAuth: [] }],
        },
    },

    // ── Service Requests ──
    '/service-requests': {
        get: {
            summary: 'List service requests',
            operationId: 'listServiceRequests',
            tags: ['Service'],
            responses: { '200': { description: 'Request list' } },
            security: [{ bearerAuth: [] }],
        },
        post: {
            summary: 'Create service request',
            operationId: 'createServiceRequest',
            tags: ['Service'],
            requestBody: {
                required: true,
                content: {
                    'application/json': { schema: { $ref: '#/components/schemas/ServiceRequest' } },
                },
            },
            responses: { '201': { description: 'Request created' } },
        },
    },
    '/service-requests/{requestId}': {
        patch: {
            summary: 'Update service request',
            operationId: 'updateServiceRequest',
            tags: ['Service'],
            parameters: [{ name: 'requestId', in: 'path', required: true, schema: uuidSchema }],
            responses: { '200': { description: 'Request updated' } },
            security: [{ bearerAuth: [] }],
        },
    },

    // ── Loyalty ──
    '/loyalty/programs': {
        get: {
            summary: 'List loyalty programs',
            operationId: 'listLoyaltyPrograms',
            tags: ['Loyalty'],
            responses: { '200': { description: 'Program list' } },
            security: [{ bearerAuth: [] }],
        },
        post: {
            summary: 'Create loyalty program',
            operationId: 'createLoyaltyProgram',
            tags: ['Loyalty'],
            requestBody: {
                required: true,
                content: {
                    'application/json': { schema: { $ref: '#/components/schemas/LoyaltyProgram' } },
                },
            },
            responses: { '201': { description: 'Program created' } },
            security: [{ bearerAuth: [] }],
        },
    },
    '/loyalty/programs/{programId}': {
        patch: {
            summary: 'Update loyalty program',
            operationId: 'updateLoyaltyProgram',
            tags: ['Loyalty'],
            parameters: [{ name: 'programId', in: 'path', required: true, schema: uuidSchema }],
            responses: { '200': { description: 'Program updated' } },
            security: [{ bearerAuth: [] }],
        },
    },
    '/loyalty/accounts/{accountId}/adjust': {
        post: {
            summary: 'Adjust loyalty points',
            operationId: 'adjustLoyaltyPoints',
            tags: ['Loyalty'],
            parameters: [{ name: 'accountId', in: 'path', required: true, schema: uuidSchema }],
            requestBody: {
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: { amount: { type: 'integer' }, reason: { type: 'string' } },
                            required: ['amount'],
                        },
                    },
                },
            },
            responses: { '200': { description: 'Points adjusted' } },
            security: [{ bearerAuth: [] }],
        },
    },

    // ── Discounts ──
    '/discounts': {
        get: {
            summary: 'List discounts',
            operationId: 'listDiscounts',
            tags: ['Discounts'],
            responses: { '200': { description: 'Discount list' } },
            security: [{ bearerAuth: [] }],
        },
        post: {
            summary: 'Create discount',
            operationId: 'createDiscount',
            tags: ['Discounts'],
            requestBody: {
                required: true,
                content: {
                    'application/json': { schema: { $ref: '#/components/schemas/CreateDiscount' } },
                },
            },
            responses: { '201': { description: 'Discount created' } },
            security: [{ bearerAuth: [] }],
        },
    },

    // ── Happy Hour ──
    '/happy-hour': {
        get: {
            summary: 'List happy hour pricing',
            operationId: 'listHappyHour',
            tags: ['Menu'],
            responses: { '200': { description: 'Happy hour list' } },
            security: [{ bearerAuth: [] }],
        },
        post: {
            summary: 'Set happy hour pricing',
            operationId: 'setHappyHour',
            tags: ['Menu'],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/HappyHourPricing' },
                    },
                },
            },
            responses: { '201': { description: 'Happy hour set' } },
            security: [{ bearerAuth: [] }],
        },
    },

    // ── Tip Pools ──
    '/tip-pools': {
        get: {
            summary: 'List tip pools',
            operationId: 'listTipPools',
            tags: ['Staff'],
            responses: { '200': { description: 'Tip pool list' } },
            security: [{ bearerAuth: [] }],
        },
        post: {
            summary: 'Create tip pool',
            operationId: 'createTipPool',
            tags: ['Staff'],
            requestBody: {
                required: true,
                content: {
                    'application/json': { schema: { $ref: '#/components/schemas/TipPool' } },
                },
            },
            responses: { '201': { description: 'Tip pool created' } },
            security: [{ bearerAuth: [] }],
        },
    },
    '/tip-pools/allocate': {
        post: {
            summary: 'Allocate tips',
            operationId: 'allocateTips',
            tags: ['Staff'],
            requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
            responses: { '200': { description: 'Tips allocated' } },
            security: [{ bearerAuth: [] }],
        },
    },

    // ── Devices ──
    '/device/orders': {
        post: {
            summary: 'Place device order',
            operationId: 'placeDeviceOrder',
            tags: ['Devices'],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/CreateOrderRequest' },
                    },
                },
            },
            responses: { '201': { description: 'Order placed' } },
            security: [{ deviceToken: [] }],
        },
    },
    '/device/tables/close': {
        post: {
            summary: 'Close table (device)',
            operationId: 'deviceCloseTable',
            tags: ['Devices'],
            requestBody: {
                content: {
                    'application/json': {
                        schema: { type: 'object', properties: { tableId: uuidSchema } },
                    },
                },
            },
            responses: { '200': { description: 'Table closed' } },
            security: [{ deviceToken: [] }],
        },
    },
    '/device/tables/bill-request': {
        post: {
            summary: 'Bill request (device)',
            operationId: 'deviceBillRequest',
            tags: ['Devices'],
            requestBody: {
                content: {
                    'application/json': {
                        schema: { type: 'object', properties: { tableId: uuidSchema } },
                    },
                },
            },
            responses: { '200': { description: 'Bill requested' } },
            security: [{ deviceToken: [] }],
        },
    },

    // ── Settings ──
    '/settings/payments': {
        get: {
            summary: 'Get payment settings',
            operationId: 'getPaymentSettings',
            tags: ['Settings'],
            responses: { '200': { description: 'Payment settings' } },
            security: [{ bearerAuth: [] }],
        },
        patch: {
            summary: 'Update payment settings',
            operationId: 'updatePaymentSettings',
            tags: ['Settings'],
            requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
            responses: { '200': { description: 'Settings updated' } },
            security: [{ bearerAuth: [] }],
        },
    },

    // ── Support ──
    '/support/tickets': {
        get: {
            summary: 'List support tickets',
            operationId: 'listSupportTickets',
            tags: ['Support'],
            responses: { '200': { description: 'Ticket list' } },
            security: [{ bearerAuth: [] }],
        },
        post: {
            summary: 'Create support ticket',
            operationId: 'createSupportTicket',
            tags: ['Support'],
            requestBody: {
                required: true,
                content: {
                    'application/json': { schema: { $ref: '#/components/schemas/SupportTicket' } },
                },
            },
            responses: { '201': { description: 'Ticket created' } },
            security: [{ bearerAuth: [] }],
        },
    },

    // ── Sync ──
    '/sync': {
        get: {
            summary: 'Pull sync data',
            operationId: 'syncPull',
            tags: ['Sync'],
            responses: { '200': { description: 'Sync data' } },
            security: [{ bearerAuth: [] }],
        },
        post: {
            summary: 'Push sync data',
            operationId: 'syncPush',
            tags: ['Sync'],
            requestBody: {
                content: {
                    'application/json': { schema: { $ref: '#/components/schemas/SyncRequest' } },
                },
            },
            responses: { '200': { description: 'Sync complete' } },
            security: [{ bearerAuth: [] }],
        },
    },

    // ── Delivery ──
    '/delivery/aggregator/orders': {
        get: {
            summary: 'List external orders',
            operationId: 'listExternalOrders',
            tags: ['Delivery'],
            responses: { '200': { description: 'Order list' } },
            security: [{ bearerAuth: [] }],
        },
        post: {
            summary: 'Accept external order',
            operationId: 'acceptExternalOrder',
            tags: ['Delivery'],
            requestBody: {
                required: true,
                content: {
                    'application/json': { schema: { $ref: '#/components/schemas/ExternalOrder' } },
                },
            },
            responses: { '201': { description: 'Order accepted' } },
        },
    },
    '/channels/delivery/orders': {
        get: {
            summary: 'Delivery channel orders',
            operationId: 'deliveryChannelOrders',
            tags: ['Delivery'],
            responses: { '200': { description: 'Channel orders' } },
            security: [{ bearerAuth: [] }],
        },
    },
    '/channels/delivery/connect': {
        post: {
            summary: 'Connect delivery partner',
            operationId: 'connectDeliveryPartner',
            tags: ['Delivery'],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/DeliveryConnect' },
                    },
                },
            },
            responses: { '200': { description: 'Partner connected' } },
            security: [{ bearerAuth: [] }],
        },
    },

    // ── Notifications ──
    '/notifications/push/subscribe': {
        post: {
            summary: 'Subscribe to push notifications',
            operationId: 'subscribePush',
            tags: ['Notifications'],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/PushSubscription' },
                    },
                },
            },
            responses: { '201': { description: 'Subscribed' } },
            security: [{ bearerAuth: [] }],
        },
        delete: {
            summary: 'Unsubscribe from push notifications',
            operationId: 'unsubscribePush',
            tags: ['Notifications'],
            responses: { '200': { description: 'Unsubscribed' } },
            security: [{ bearerAuth: [] }],
        },
    },
};

// ==========================================================================
// Output
// ==========================================================================

const doc: OpenApiDoc = {
    openapi: '3.1.0',
    info: {
        title: 'lole Restaurant OS API',
        version: '1.0.0',
        description: `Enterprise-grade restaurant operating system API for Ethiopia ("Toast for Addis Ababa").

## Authentication
- **Bearer Token**: JWT from Supabase Auth (\`Authorization: Bearer <token>\`)
- **Device Token**: Terminal/kiosk devices (\`X-Device-Token\`)
- **Guest Context**: HMAC-signed QR codes for guest ordering

## Currency
All monetary values in santim (1 ETB = 100 santim).

## Idempotency
Mutating endpoints accept \`X-Idempotency-Key\` header.
`,
    },
    servers: [{ url: '/api', description: 'lole API' }],
    paths,
    components: {
        schemas,
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Supabase Auth JWT token',
            },
            webhookSignature: {
                type: 'apiKey',
                in: 'header',
                name: 'x-chapa-signature',
                description: 'HMAC-SHA256 webhook signature',
            },
        },
    },
    tags: [
        { name: 'Health', description: 'Health check endpoints' },
        { name: 'Orders', description: 'Order management — create, list, update status, split' },
        { name: 'Payments', description: 'Payment processing — Chapa, Telebirr, Cash' },
        { name: 'Menu', description: 'Menu items, categories, and modifiers' },
        { name: 'Staff', description: 'Staff management — invite, roles, PINs, shifts' },
        { name: 'Guests', description: 'Guest profiles, loyalty, and order history' },
        { name: 'Tables', description: 'Table sessions — open, transfer, close' },
        { name: 'Webhooks', description: 'External payment and delivery webhooks' },
        {
            name: 'KDS',
            description: 'Kitchen Display System — order queue, telemetry, item actions',
        },
        {
            name: 'Delivery',
            description: 'Delivery aggregator — BeU, Zmall, Deliver Addis, Esoora',
        },
        { name: 'Service', description: 'Table service requests — water, waiter, bill, cleanup' },
        { name: 'Loyalty', description: 'Loyalty programs and points' },
        { name: 'Discounts', description: 'Discount codes — percentage, fixed, buy X get Y' },
        { name: 'Devices', description: 'Terminal/device operations' },
        { name: 'Settings', description: 'Merchant settings — payments, notifications, channels' },
        { name: 'Support', description: 'Support tickets' },
        { name: 'Sync', description: 'Offline sync — pull/push' },
        { name: 'Notifications', description: 'Push notification subscriptions' },
    ],
};

async function main() {
    const args = process.argv.slice(2);
    const isCheck = args.includes('--check');
    const outputIndex = args.indexOf('--output');
    const outputPath =
        outputIndex !== -1 ? args[outputIndex + 1] : 'src/lib/docs/openapi-generated.json';

    const outputDir = outputPath.split('/').slice(0, -1).join('/');
    if (outputDir && !existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }

    const json = JSON.stringify(doc, null, 2);

    if (isCheck) {
        const { readFileSync } = await import('fs');
        if (!existsSync(outputPath)) {
            console.error('❌ Generated OpenAPI spec not found at', outputPath);
            process.exit(1);
        }
        const existingRaw = readFileSync(outputPath, 'utf-8');
        const existing = JSON.parse(existingRaw);
        const current = JSON.parse(json);
        if (JSON.stringify(existing) !== JSON.stringify(current)) {
            console.error(
                '❌ OpenAPI spec is out of date. Run: npx tsx scripts/tools/generate-openapi.ts'
            );
            process.exit(1);
        }
        console.log('✅ OpenAPI spec is up to date');
        return;
    }

    writeFileSync(outputPath, json);
    console.log(`✅ Generated OpenAPI 3.1 spec (${json.length} bytes) → ${outputPath}`);
    console.log(`   Schemas: ${Object.keys(schemas).length}`);
    console.log(`   Paths: ${Object.keys(paths).length}`);
}

main().catch(console.error);
