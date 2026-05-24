import { describe, expect, it, vi } from 'vitest';
import {
    AggregatorService,
    buildAggregatorOrderLanEvent,
    normalizeDeliveryPartnerName,
} from './aggregator';

describe('AggregatorService', () => {
    it('normalizes supported Ethiopian partner names', () => {
        expect(normalizeDeliveryPartnerName('BeU')).toBe('beu');
        expect(normalizeDeliveryPartnerName('Zmall')).toBe('zmall');
        expect(normalizeDeliveryPartnerName('Telebirr Food')).toBe('telebirr_food');
        expect(normalizeDeliveryPartnerName('Deliver Addis')).toBe('deliver_addis');
    });

    it('builds local-first LAN events for inbound aggregator orders', () => {
        const event = buildAggregatorOrderLanEvent({
            id: 'agg-1',
            restaurant_id: 'rest-1',
            delivery_partner_id: 'partner-1',
            external_order_id: 'ext-1',
            external_order_number: 'B-100',
            internal_order_id: null,
            raw_order_data: {},
            customer_name: 'Abel',
            customer_phone: null,
            delivery_address: null,
            delivery_latitude: null,
            delivery_longitude: null,
            delivery_notes: null,
            items: [],
            subtotal: 100,
            delivery_fee: 10,
            platform_fee: 5,
            total: 115,
            status: 'pending',
            placed_at: '2026-04-28T10:00:00.000Z',
            estimated_pickup_at: null,
            estimated_delivery_at: null,
        });

        expect(event).toMatchObject({
            schema: 'lole.gateway.lan-event',
            aggregate: 'aggregator_order',
            aggregateId: 'agg-1',
            type: 'delivery.aggregator.order.received',
            restaurantId: 'rest-1',
        });
    });

    it('publishes local bus envelope after inbound order persistence', async () => {
        const publishLocalEvent = vi.fn();
        const service = new AggregatorService({
            publishLocalEvent,
            receiveOrder: vi.fn().mockResolvedValue({
                success: true,
                order: {
                    id: 'agg-2',
                    restaurant_id: 'rest-1',
                    delivery_partner_id: 'partner-1',
                    external_order_id: 'ext-2',
                    external_order_number: null,
                    internal_order_id: null,
                    raw_order_data: {},
                    customer_name: null,
                    customer_phone: null,
                    delivery_address: null,
                    delivery_latitude: null,
                    delivery_longitude: null,
                    delivery_notes: null,
                    items: [],
                    subtotal: 200,
                    delivery_fee: 15,
                    platform_fee: 0,
                    total: 215,
                    status: 'pending',
                    placed_at: '2026-04-28T10:00:00.000Z',
                    estimated_pickup_at: null,
                    estimated_delivery_at: null,
                },
            }),
        });

        const result = await service.receiveAndBroadcastOrder({} as never, 'rest-1', 'partner-1', {
            external_order_id: 'ext-2',
            raw_order_data: {},
            items: [],
            subtotal: 200,
            total: 215,
        });

        expect(result.success).toBe(true);
        expect(publishLocalEvent).toHaveBeenCalledOnce();
    });
});
