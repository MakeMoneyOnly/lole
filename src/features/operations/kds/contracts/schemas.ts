import { z } from 'zod';

const KDSStatusEnum = z.enum(['pending', 'confirmed', 'acknowledged', 'preparing', 'ready']);

const StationEnum = z.enum([
    'all',
    'kitchen',
    'bar',
    'dessert',
    'coffee',
    'grill',
    'cold',
    'expeditor',
]);

const SlaStatusEnum = z.enum(['on_track', 'at_risk', 'breached']);

export const GetKDSQueueQuerySchema = z.object({
    restaurantId: z.string().uuid(),
    status: KDSStatusEnum.optional(),
    station: StationEnum.default('all'),
    sla_status: SlaStatusEnum.optional(),
    sla_minutes: z.coerce.number().int().min(5).max(180).default(30),
    cursor: z.string().min(8).max(400).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type GetKDSQueueQuery = z.infer<typeof GetKDSQueueQuerySchema>;

export const UpdateKDSStatusSchema = z.object({
    restaurantId: z.string().uuid(),
    orderId: z.string().uuid(),
    status: KDSStatusEnum,
    staffId: z.string().uuid().optional(),
});

export type UpdateKDSStatusCommand = z.infer<typeof UpdateKDSStatusSchema>;

export const TelemetryQuerySchema = z.object({
    restaurantId: z.string().uuid().optional(),
    sla_minutes: z.coerce.number().int().min(5).max(180).default(30),
});

export type TelemetryQuery = z.infer<typeof TelemetryQuerySchema>;

export { KDSStatusEnum, StationEnum, SlaStatusEnum };
