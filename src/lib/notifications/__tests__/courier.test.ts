/**
 * Tests for Courier notification service
 *
 * Focuses on branch coverage for:
 * - formatEthiopianPhone (all Ethiopian phone formats)
 * - sendCourierNotification (success and failure cases)
 * - sendMultiChannelNotification (channel fallback logic)
 * - sendTransactionalNotification (idempotency key requirement)
 * - sendOrderStatusNotification (all status types)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

const mockCourierSend = vi.fn();

vi.mock('@trycourier/courier', () => {
    return {
        default: class {
            send = { message: mockCourierSend };
            constructor(_options: unknown) {}
        },
    };
});

describe('Courier notifications', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        process.env.COURIER_AUTH_TOKEN = 'test-courier-token';
        process.env.COURIER_API_KEY = 'test-courier-api-key';
        mockCourierSend.mockClear();
    });

    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
    });

    describe('formatEthiopianPhone', () => {
        it('should format phone with +251 prefix', async () => {
            const { formatEthiopianPhone } = await import('../courier');
            expect(formatEthiopianPhone('+251911123456')).toBe('+251911123456');
        });

        it('should format phone with 0 prefix to +251', async () => {
            const { formatEthiopianPhone } = await import('../courier');
            expect(formatEthiopianPhone('0911123456')).toBe('+251911123456');
        });

        it('should format 9-digit phone starting with 9 to +251', async () => {
            const { formatEthiopianPhone } = await import('../courier');
            expect(formatEthiopianPhone('911123456')).toBe('+251911123456');
        });

        it('should format phone with 251 prefix without +', async () => {
            const { formatEthiopianPhone } = await import('../courier');
            expect(formatEthiopianPhone('251911123456')).toBe('+251911123456');
        });

        it('should handle phone with spaces by trimming', async () => {
            const { formatEthiopianPhone } = await import('../courier');
            expect(formatEthiopianPhone(' +251911123456 ')).toBe('+251911123456');
        });

        it('should add +251 prefix to bare number', async () => {
            const { formatEthiopianPhone } = await import('../courier');
            expect(formatEthiopianPhone('911123456')).toBe('+251911123456');
        });
    });

    describe('sendCourierNotification', () => {
        it('should return success with valid response', async () => {
            mockCourierSend.mockResolvedValueOnce({ requestId: 'msg-123' });

            const { sendCourierNotification } = await import('../courier');
            const result = await sendCourierNotification({
                recipient: { user_id: 'user-123' },
                content: { title: 'Test', body: 'Test message' },
            });

            expect(result.success).toBe(true);
            expect(result.channel).toBe('sms');
            expect(result.messageId).toBe('msg-123');
            expect(result.provider).toBe('courier');
        });

        it('should return failure when courier throws error', async () => {
            mockCourierSend.mockRejectedValueOnce(new Error('Courier API error'));

            const { sendCourierNotification } = await import('../courier');
            const result = await sendCourierNotification({
                recipient: { user_id: 'user-123' },
                content: { title: 'Test', body: 'Test message' },
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Courier API error');
        });

        it('should use specified channel from channels array', async () => {
            mockCourierSend.mockResolvedValueOnce({ requestId: 'msg-456' });

            const { sendCourierNotification } = await import('../courier');
            const result = await sendCourierNotification({
                recipient: { user_id: 'user-123' },
                content: { title: 'Test', body: 'Test message' },
                channels: ['push'],
            });

            expect(result.success).toBe(true);
            expect(result.channel).toBe('push');
        });
    });

    describe('sendMultiChannelNotification', () => {
        it('should return success on first channel success', async () => {
            mockCourierSend.mockResolvedValueOnce({ requestId: 'msg-123' });

            const { sendMultiChannelNotification } = await import('../courier');
            const result = await sendMultiChannelNotification({
                recipient: { user_id: 'user-123' },
                content: { title: 'Test', body: 'Test message' },
                channels: ['push', 'sms', 'email'],
            });

            expect(result.success).toBe(true);
            expect(result.channel).toBe('push');
            expect(result.attemptedChannels).toEqual(['push']);
        });

        it('should fallback to next channel on failure', async () => {
            mockCourierSend
                .mockRejectedValueOnce(new Error('Push failed'))
                .mockResolvedValueOnce({ requestId: 'msg-456' });

            const { sendMultiChannelNotification } = await import('../courier');
            const result = await sendMultiChannelNotification({
                recipient: { user_id: 'user-123' },
                content: { title: 'Test', body: 'Test message' },
                channels: ['push', 'sms', 'email'],
            });

            expect(result.success).toBe(true);
            expect(result.channel).toBe('sms');
            expect(result.attemptedChannels).toEqual(['push', 'sms']);
        });

        it('should return failure when all channels fail', async () => {
            mockCourierSend
                .mockRejectedValueOnce(new Error('Push failed'))
                .mockRejectedValueOnce(new Error('SMS failed'))
                .mockRejectedValueOnce(new Error('Email failed'));

            const { sendMultiChannelNotification } = await import('../courier');
            const result = await sendMultiChannelNotification({
                recipient: { user_id: 'user-123' },
                content: { title: 'Test', body: 'Test message' },
                channels: ['push', 'sms', 'email'],
            });

            expect(result.success).toBe(false);
            expect(result.channel).toBe('none');
            expect(result.attemptedChannels).toEqual(['push', 'sms', 'email']);
        });

        it('should use default channels when not specified', async () => {
            mockCourierSend.mockResolvedValueOnce({ requestId: 'msg-123' });

            const { sendMultiChannelNotification } = await import('../courier');
            const result = await sendMultiChannelNotification({
                recipient: { user_id: 'user-123' },
                content: { title: 'Test', body: 'Test message' },
            });

            expect(result.success).toBe(true);
            expect(result.channel).toBe('push');
        });
    });

    describe('sendTransactionalNotification', () => {
        it('should throw error when idempotency key is missing', async () => {
            const { sendTransactionalNotification } = await import('../courier');

            await expect(
                sendTransactionalNotification({
                    recipient: { user_id: 'user-123' },
                    content: { title: 'Test', body: 'Test message' },
                })
            ).rejects.toThrow('Idempotency key is required for transactional notifications');
        });

        it('should send successfully with idempotency key', async () => {
            mockCourierSend.mockResolvedValueOnce({ requestId: 'tx-123' });

            const { sendTransactionalNotification } = await import('../courier');
            const result = await sendTransactionalNotification({
                recipient: { user_id: 'user-123' },
                content: { title: 'Test', body: 'Test message' },
                idempotencyKey: 'unique-key-123',
            });

            expect(result.success).toBe(true);
            expect(result.messageId).toBe('tx-123');
        });

        it('should include idempotency key in request headers', async () => {
            mockCourierSend.mockResolvedValueOnce({ requestId: 'tx-123' });

            const { sendTransactionalNotification } = await import('../courier');
            await sendTransactionalNotification({
                recipient: { user_id: 'user-123' },
                content: { title: 'Test', body: 'Test message' },
                idempotencyKey: 'my-key-456',
            });

            expect(mockCourierSend).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.any(Object),
                }),
                expect.objectContaining({
                    headers: {
                        'Idempotency-Key': 'my-key-456_sms',
                    },
                })
            );
        });
    });

    describe('sendOrderStatusNotification', () => {
        it('should send preparing status notification', async () => {
            mockCourierSend.mockResolvedValueOnce({ requestId: 'order-123' });

            const { sendOrderStatusNotification } = await import('../courier');
            const result = await sendOrderStatusNotification(
                { user_id: 'user-123' },
                'ORD-001',
                'preparing',
                'idempotency-key'
            );

            expect(result.success).toBe(true);
            expect(result.channel).toBe('push');
        });

        it('should send ready status notification', async () => {
            mockCourierSend.mockResolvedValueOnce({ requestId: 'order-456' });

            const { sendOrderStatusNotification } = await import('../courier');
            const result = await sendOrderStatusNotification(
                { user_id: 'user-123' },
                'ORD-001',
                'ready',
                'idempotency-key'
            );

            expect(result.success).toBe(true);
        });

        it('should send served status notification', async () => {
            mockCourierSend.mockResolvedValueOnce({ requestId: 'order-789' });

            const { sendOrderStatusNotification } = await import('../courier');
            const result = await sendOrderStatusNotification(
                { user_id: 'user-123' },
                'ORD-001',
                'served',
                'idempotency-key'
            );

            expect(result.success).toBe(true);
        });

        it('should send completed status notification', async () => {
            mockCourierSend.mockResolvedValueOnce({ requestId: 'order-complete' });

            const { sendOrderStatusNotification } = await import('../courier');
            const result = await sendOrderStatusNotification(
                { user_id: 'user-123' },
                'ORD-001',
                'completed',
                'idempotency-key'
            );

            expect(result.success).toBe(true);
        });

        it('should send cancelled status notification', async () => {
            mockCourierSend.mockResolvedValueOnce({ requestId: 'order-cancel' });

            const { sendOrderStatusNotification } = await import('../courier');
            const result = await sendOrderStatusNotification(
                { user_id: 'user-123' },
                'ORD-001',
                'cancelled',
                'idempotency-key'
            );

            expect(result.success).toBe(true);
        });

        it('should handle unknown status with default message', async () => {
            mockCourierSend.mockResolvedValueOnce({ requestId: 'order-unknown' });

            const { sendOrderStatusNotification } = await import('../courier');
            const result = await sendOrderStatusNotification(
                { user_id: 'user-123' },
                'ORD-001',
                'shipped',
                'idempotency-key'
            );

            expect(result.success).toBe(true);
        });
    });
});
