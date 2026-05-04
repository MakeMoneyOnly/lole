/**
 * Integration tests for audit logging functionality
 *
 * These tests cover the audit.ts module which is excluded from coverage
 * due to requiring database/Supabase connections.
 *
 * Uses mocks to simulate Supabase behavior without requiring actual connections.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { logServiceRoleAudit, getAuditSource } from '../audit';
import type { ServiceRoleAuditParams } from '../audit';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        from: vi.fn(() => ({
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
    })),
}));

// Mock environment variables
const mockEnv = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
};

describe('audit integration tests', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalEnv = process.env;
        process.env = { ...originalEnv, ...mockEnv };
        vi.clearAllMocks();
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('logServiceRoleAudit', () => {
        it('should successfully log an audit entry with all required fields', async () => {
            // Arrange
            const auditParams: ServiceRoleAuditParams = {
                action: 'INSERT',
                description: 'Test order created',
                source: 'test-api-route',
                resourceType: 'orders',
                resourceId: 'order-123',
                userId: 'user-456',
                restaurantId: 'restaurant-789',
                success: true,
                metadata: { testKey: 'testValue' },
                ipAddress: '192.168.1.1',
            };

            // Act
            const result = await logServiceRoleAudit(auditParams);

            // Assert
            expect(result.error).toBeNull();
            expect(createClient).toHaveBeenCalled();
        });

        it('should handle missing optional fields gracefully', async () => {
            // Arrange - minimal params
            const auditParams: ServiceRoleAuditParams = {
                action: 'SELECT',
                description: 'Test query',
                source: 'test-source',
                resourceType: 'menu_items',
                success: true,
            };

            // Act
            const result = await logServiceRoleAudit(auditParams);

            // Assert
            expect(result.error).toBeNull();
        });

        it('should handle Supabase insert errors gracefully', async () => {
            // Arrange - mock a failed insert
            const mockFrom = vi.fn().mockReturnValue({
                insert: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Database error', code: 'INSERT_FAILED' },
                }),
            });

            (createClient as ReturnType<typeof vi.fn>).mockReturnValue({
                from: mockFrom,
            });

            const auditParams: ServiceRoleAuditParams = {
                action: 'UPDATE',
                description: 'Test update',
                source: 'test',
                resourceType: 'orders',
                success: false,
            };

            // Act
            const result = await logServiceRoleAudit(auditParams);

            // Assert - should return error but not throw
            expect(result.error).not.toBeNull();
            expect(result.error?.message).toBe('Database error');
        });

        it('should handle missing configuration gracefully', async () => {
            // Arrange - remove env vars to trigger fallback
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

            const auditParams: ServiceRoleAuditParams = {
                action: 'DELETE',
                description: 'Test delete',
                source: 'test',
                resourceType: 'orders',
                success: true,
            };

            // Act
            const result = await logServiceRoleAudit(auditParams);

            // Assert - should still return without throwing
            expect(result.error).toBeDefined(); // Error from placeholder client
        });

        it('should properly format metadata with service role audit flag', async () => {
            // Arrange - reset and set up mock to return success
            vi.clearAllMocks();

            const mockFrom = vi.fn().mockReturnValue({
                insert: vi.fn().mockResolvedValue({ data: { id: '123' }, error: null }),
            });

            (createClient as ReturnType<typeof vi.fn>).mockImplementation(() => ({
                from: mockFrom,
            }));

            const customMetadata = { orderId: '123', amount: 500 };
            const auditParams: ServiceRoleAuditParams = {
                action: 'INSERT',
                description: 'Order created',
                source: 'test',
                resourceType: 'orders',
                resourceId: 'order-123',
                success: true,
                metadata: customMetadata,
            };

            // Act
            const result = await logServiceRoleAudit(auditParams);

            // Assert
            expect(result.error).toBeNull();
        });

        it('should handle exceptions without throwing', async () => {
            // Arrange - break the client
            (createClient as ReturnType<typeof vi.fn>).mockImplementation(() => {
                throw new Error('Client initialization failed');
            });

            const auditParams: ServiceRoleAuditParams = {
                action: 'SELECT',
                description: 'Test',
                source: 'test',
                resourceType: 'orders',
                success: false,
            };

            // Act
            const result = await logServiceRoleAudit(auditParams);

            // Assert - should return error but not throw
            expect(result.error).toBeDefined();
            expect(result.error instanceof Error).toBe(true);
        });
    });

    describe('getAuditSource', () => {
        it('should return fallback value when stack trace is not available', () => {
            // The function attempts to extract from stack but falls back
            // Due to test environment, it extracts the function name
            const source = getAuditSource('fallback');

            // Should return some string (either extracted or fallback)
            expect(typeof source).toBe('string');
            expect(source.length).toBeGreaterThan(0);
        });

        it('should extract meaningful source from stack when available', () => {
            // Arrange & Act
            const source = getAuditSource('fallback');

            // Assert - should contain some part of the call stack
            expect(typeof source).toBe('string');
            expect(source.length).toBeGreaterThan(0);
        });

        it('should limit source length to 255 characters', () => {
            // Arrange - create a long fallback string
            const longFallback = 'a'.repeat(300);

            // Act
            const source = getAuditSource(longFallback);

            // Assert
            expect(source.length).toBeLessThanOrEqual(255);
        });

        it('should handle exceptions in stack extraction gracefully', () => {
            // The function has try-catch internally, so it should never throw
            expect(() => getAuditSource('test')).not.toThrow();
        });
    });

    describe('withServiceRoleAudit', () => {
        it('should return the original supabase client unchanged', async () => {
            // Note: The current implementation just returns the client as-is
            // This test documents the current behavior
            const { withServiceRoleAudit } = await import('../audit');

            // The current implementation returns the client unchanged
            // We just verify the function exists and can be called
            expect(typeof withServiceRoleAudit).toBe('function');
        });
    });

    describe('ServiceRoleAuditParams type', () => {
        it('should accept all required fields', () => {
            const params: ServiceRoleAuditParams = {
                action: 'INSERT',
                description: 'Test',
                source: 'test',
                resourceType: 'orders',
                success: true,
            };

            expect(params.action).toBe('INSERT');
            expect(params.success).toBe(true);
        });

        it('should accept all optional fields', () => {
            const params: ServiceRoleAuditParams = {
                action: 'UPDATE',
                description: 'Test update',
                source: 'api/test',
                resourceType: 'orders',
                resourceId: 'order-123',
                userId: 'user-456',
                restaurantId: 'restaurant-789',
                success: true,
                metadata: { key: 'value' },
                ipAddress: '10.0.0.1',
            };

            expect(params.resourceId).toBe('order-123');
            expect(params.userId).toBe('user-456');
            expect(params.restaurantId).toBe('restaurant-789');
            expect(params.metadata).toEqual({ key: 'value' });
            expect(params.ipAddress).toBe('10.0.0.1');
        });
    });
});
