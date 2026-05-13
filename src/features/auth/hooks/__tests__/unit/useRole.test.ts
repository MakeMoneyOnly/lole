/**
 * Tests for useRole hook
 * HIGH-008: Add tests for critical hooks
 */
import { renderHook, waitFor, act as _act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRole } from '../../useRole';

// Mock next/navigation
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
    }),
}));

// Mock supabase client
const mockGetUser = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockOnAuthStateChange = vi.fn(() => ({
    data: {
        subscription: {
            unsubscribe: vi.fn(),
        },
    },
}));

vi.mock('@/lib/supabase/client', () => ({
    getSupabaseClient: () => ({
        auth: {
            getUser: mockGetUser,
            onAuthStateChange: mockOnAuthStateChange,
        },
        rpc: mockRpc,
        from: mockFrom,
    }),
}));

describe('useRole', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFrom.mockReturnValue({
            select: mockSelect,
        });
        mockSelect.mockReturnValue({
            eq: mockEq,
        });
        mockEq.mockReturnValue({
            eq: mockEq,
            maybeSingle: mockMaybeSingle,
            order: mockOrder,
        });
        mockOrder.mockReturnValue({
            limit: mockLimit,
        });
        mockLimit.mockReturnValue({
            maybeSingle: mockMaybeSingle,
        });
    });

    it('should return null role when user is not authenticated', async () => {
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: new Error('Not authenticated'),
        });

        const { result } = renderHook(() => useRole(null));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.role).toBeNull();
        expect(result.current.user).toBeNull();
    });

    it('should fetch role for authenticated user with restaurantId', async () => {
        const mockUser = {
            id: 'user-123',
            email: 'test@example.com',
        };

        mockGetUser.mockResolvedValue({
            data: { user: mockUser },
            error: null,
        });

        mockRpc.mockResolvedValue({
            data: { role: 'admin', restaurant_id: 'restaurant-123' },
            error: null,
        });

        const { result } = renderHook(() => useRole('restaurant-123'));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.role).toBe('admin');
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.restaurantId).toBe('restaurant-123');
    });

    it('should fallback to direct query when RPC fails', async () => {
        const mockUser = {
            id: 'user-123',
            email: 'test@example.com',
        };

        mockGetUser.mockResolvedValue({
            data: { user: mockUser },
            error: null,
        });

        mockRpc.mockResolvedValue({
            data: null,
            error: new Error('RPC failed'),
        });

        mockMaybeSingle.mockResolvedValue({
            data: { role: 'manager', restaurant_id: 'restaurant-456', is_active: true },
            error: null,
        });

        const { result } = renderHook(() => useRole('restaurant-456'));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.role).toBe('manager');
        expect(result.current.restaurantId).toBe('restaurant-456');
    });

    it('should return null role for inactive staff', async () => {
        const mockUser = {
            id: 'user-123',
            email: 'test@example.com',
        };

        mockGetUser.mockResolvedValue({
            data: { user: mockUser },
            error: null,
        });

        mockRpc.mockResolvedValue({
            data: null,
            error: new Error('RPC failed'),
        });

        mockMaybeSingle.mockResolvedValue({
            data: { role: 'waiter', restaurant_id: 'restaurant-789', is_active: false },
            error: null,
        });

        const { result } = renderHook(() => useRole('restaurant-789'));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.role).toBeNull();
    });

    it('should handle loading state correctly', async () => {
        mockGetUser.mockImplementation(() => new Promise(() => {})); // Never resolves

        const { result } = renderHook(() => useRole('restaurant-123'));

        expect(result.current.loading).toBe(true);
    });
});
