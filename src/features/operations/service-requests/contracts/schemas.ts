import { z } from 'zod';

const ServiceRequestStatusEnum = z.enum(['pending', 'in_progress', 'completed']);
const ServiceRequestTypeEnum = z.enum(['waiter', 'bill', 'cutlery', 'other']);

export const ListServiceRequestsQuerySchema = z.object({
    restaurantId: z.string().uuid(),
    status: ServiceRequestStatusEnum.optional(),
    search: z.string().optional(),
    limit: z.coerce.number().int().positive().max(200).default(100),
    offset: z.coerce.number().int().nonnegative().default(0),
});

export type ListServiceRequestsQuery = z.infer<typeof ListServiceRequestsQuerySchema>;

export const UpdateServiceRequestSchema = z.object({
    restaurantId: z.string().uuid(),
    requestId: z.string().uuid(),
    status: ServiceRequestStatusEnum,
    staffId: z.string().uuid(),
});

export type UpdateServiceRequestCommand = z.infer<typeof UpdateServiceRequestSchema>;

export const ServiceRequestResponseSchema = z.object({
    id: z.string().uuid(),
    restaurant_id: z.string().uuid(),
    table_number: z.string(),
    request_type: ServiceRequestTypeEnum,
    status: ServiceRequestStatusEnum,
    notes: z.string().nullable(),
    completed_at: z.string().datetime().nullable(),
    idempotency_key: z.string().nullable(),
    created_at: z.string().datetime(),
});

export type ServiceRequestResponse = z.infer<typeof ServiceRequestResponseSchema>;

export { ServiceRequestStatusEnum, ServiceRequestTypeEnum };
