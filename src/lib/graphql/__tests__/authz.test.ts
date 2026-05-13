import { describe, it, expect, vi } from 'vitest';
import { GraphQLError } from 'graphql';
import {
    requireAuth,
    requireRestaurantAccess,
    withRestaurantAccess,
    verifyTenantIsolation,
    requireRole,
    AuthorizedContext,
} from '../authz';
import { GraphQLContext } from '../context';
import { DataLoaders } from '../dataloaders';

// Mock DataLoaders for testing
const mockDataLoaders = {} as DataLoaders;

describe('GraphQL Authorization', () => {
    describe('requireAuth', () => {
        it('should throw UNAUTHORIZED error when user is null', () => {
            const context: GraphQLContext = {
                user: null,
                token: null,
                guestSession: null,
                dataLoaders: mockDataLoaders,
            };

            expect(() => requireAuth(context)).toThrow(GraphQLError);

            try {
                requireAuth(context);
            } catch (error) {
                expect(error).toBeInstanceOf(GraphQLError);
                expect((error as GraphQLError).extensions?.code).toBe('UNAUTHORIZED');
                expect(
                    ((error as GraphQLError).extensions?.http as { status?: number })?.status
                ).toBe(401);
            }
        });

        it('should throw UNAUTHORIZED error when user is undefined', () => {
            const context = {
                user: undefined,
                token: 'some-token',
                guestSession: null,
                dataLoaders: mockDataLoaders,
            } as unknown as GraphQLContext;

            expect(() => requireAuth(context)).toThrow(GraphQLError);
        });

        it('should return context when user is present', () => {
            const context: GraphQLContext = {
                user: { id: 'user-1', restaurantId: 'rest-1' },
                token: 'valid-token',
                guestSession: null,
                dataLoaders: mockDataLoaders,
            };

            const result = requireAuth(context);
            expect(result.user.id).toBe('user-1');
            expect(result.user.restaurantId).toBe('rest-1');
        });

        it('should return AuthorizedContext with guaranteed user', () => {
            const context: GraphQLContext = {
                user: { id: 'user-2', restaurantId: 'rest-2', role: 'manager' },
                token: 'token',
                guestSession: null,
                dataLoaders: mockDataLoaders,
            };

            const result = requireAuth(context);
            // TypeScript should infer result.user is non-nullable
            expect(result.user.id).toBeDefined();
            expect(result.user.restaurantId).toBeDefined();
        });
    });

    describe('requireRestaurantAccess', () => {
        it('should throw UNAUTHORIZED when user is null', async () => {
            const context: GraphQLContext = {
                user: null,
                token: null,
                guestSession: null,
                dataLoaders: mockDataLoaders,
            };

            await expect(requireRestaurantAccess(context, 'rest-1')).rejects.toThrow(GraphQLError);

            try {
                await requireRestaurantAccess(context, 'rest-1');
            } catch (error) {
                expect(error).toBeInstanceOf(GraphQLError);
                expect((error as GraphQLError).extensions?.code).toBe('UNAUTHORIZED');
            }
        });

        it('should throw FORBIDDEN when user lacks access to different restaurant', async () => {
            const context: GraphQLContext = {
                user: { id: 'user-1', restaurantId: 'rest-1' },
                token: 'token',
                guestSession: null,
                dataLoaders: mockDataLoaders,
            };

            await expect(requireRestaurantAccess(context, 'rest-2')).rejects.toThrow(GraphQLError);

            try {
                await requireRestaurantAccess(context, 'rest-2');
            } catch (error) {
                expect(error).toBeInstanceOf(GraphQLError);
                expect((error as GraphQLError).extensions?.code).toBe('FORBIDDEN');
                expect(
                    ((error as GraphQLError).extensions?.http as { status?: number })?.status
                ).toBe(403);
                expect((error as GraphQLError).extensions?.restaurantId).toBe('rest-2');
            }
        });

        it('should return context when user has access to the restaurant', async () => {
            const context: GraphQLContext = {
                user: { id: 'user-1', restaurantId: 'rest-1' },
                token: 'token',
                guestSession: null,
                dataLoaders: mockDataLoaders,
            };

            const result = await requireRestaurantAccess(context, 'rest-1');
            expect(result.user.id).toBe('user-1');
            expect(result.user.restaurantId).toBe('rest-1');
        });

        it('should allow access when restaurantId matches as string', async () => {
            const context: GraphQLContext = {
                user: { id: 'user-1', restaurantId: 'restaurant-uuid-123' },
                token: 'token',
                guestSession: null,
                dataLoaders: mockDataLoaders,
            };

            const result = await requireRestaurantAccess(context, 'restaurant-uuid-123');
            expect(result.user.id).toBe('user-1');
        });
    });

    describe('withRestaurantAccess', () => {
        it('should wrap resolver and check restaurant access', async () => {
            const mockResolver = vi.fn().mockResolvedValue({ success: true });

            const wrappedResolver = withRestaurantAccess(mockResolver);

            const context: GraphQLContext = {
                user: { id: 'user-1', restaurantId: 'rest-1' },
                token: 'token',
                guestSession: null,
                dataLoaders: mockDataLoaders,
            };

            const args = { restaurantId: 'rest-1', otherArg: 'value' };

            await wrappedResolver(null, args, context);

            expect(mockResolver).toHaveBeenCalledWith(
                null,
                args,
                expect.objectContaining({
                    user: { id: 'user-1', restaurantId: 'rest-1' },
                })
            );
        });

        it('should throw FORBIDDEN when resolver args have different restaurantId', async () => {
            const mockResolver = vi.fn().mockResolvedValue({ success: true });

            const wrappedResolver = withRestaurantAccess(mockResolver);

            const context: GraphQLContext = {
                user: { id: 'user-1', restaurantId: 'rest-1' },
                token: 'token',
                guestSession: null,
                dataLoaders: mockDataLoaders,
            };

            const args = { restaurantId: 'rest-2', otherArg: 'value' };

            await expect(wrappedResolver(null, args, context)).rejects.toThrow(GraphQLError);
            expect(mockResolver).not.toHaveBeenCalled();
        });

        it('should throw UNAUTHORIZED when user is null', async () => {
            const mockResolver = vi.fn().mockResolvedValue({ success: true });

            const wrappedResolver = withRestaurantAccess(mockResolver);

            const context: GraphQLContext = {
                user: null,
                token: null,
                guestSession: null,
                dataLoaders: mockDataLoaders,
            };

            const args = { restaurantId: 'rest-1' };

            await expect(wrappedResolver(null, args, context)).rejects.toThrow(GraphQLError);
            expect(mockResolver).not.toHaveBeenCalled();
        });
    });

    describe('verifyTenantIsolation', () => {
        it('should not throw when entity belongs to user restaurant', () => {
            const context: AuthorizedContext = {
                user: { id: 'user-1', restaurantId: 'rest-1' },
                token: 'token',
                guestSession: null,
                dataLoaders: mockDataLoaders,
            };

            // Should not throw
            expect(() => verifyTenantIsolation(context, 'rest-1')).not.toThrow();
        });

        it('should throw FORBIDDEN when entity belongs to different restaurant', () => {
            const context: AuthorizedContext = {
                user: { id: 'user-1', restaurantId: 'rest-1' },
                token: 'token',
                guestSession: null,
                dataLoaders: mockDataLoaders,
            };

            expect(() => verifyTenantIsolation(context, 'rest-2')).toThrow(GraphQLError);

            try {
                verifyTenantIsolation(context, 'rest-2');
            } catch (error) {
                expect(error).toBeInstanceOf(GraphQLError);
                expect((error as GraphQLError).extensions?.code).toBe('FORBIDDEN');
                expect(
                    ((error as GraphQLError).extensions?.http as { status?: number })?.status
                ).toBe(403);
            }
        });

        it('should throw FORBIDDEN with correct error message', () => {
            const context: AuthorizedContext = {
                user: { id: 'user-1', restaurantId: 'rest-1' },
                token: 'token',
                guestSession: null,
                dataLoaders: mockDataLoaders,
            };

            try {
                verifyTenantIsolation(context, 'rest-malicious');
            } catch (error) {
                expect(error).toBeInstanceOf(GraphQLError);
                expect((error as GraphQLError).message).toBe('Access denied to this resource');
                expect((error as GraphQLError).extensions?.code).toBe('FORBIDDEN');
            }
        });
    });

    describe('requireRole', () => {
        it('should not throw when user has an allowed role', () => {
            const context: AuthorizedContext = {
                user: { id: 'user-1', restaurantId: 'rest-1', role: 'admin' },
                token: 'token',
                guestSession: null,
                dataLoaders: mockDataLoaders,
            };

            expect(() => requireRole(context, ['admin', 'manager'])).not.toThrow();
        });

        it('should not throw when user has the first allowed role', () => {
            const context: AuthorizedContext = {
                user: { id: 'user-1', restaurantId: 'rest-1', role: 'admin' },
                token: 'token',
                guestSession: null,
                dataLoaders: mockDataLoaders,
            };

            expect(() => requireRole(context, ['admin'])).not.toThrow();
        });

        it('should throw FORBIDDEN when user role is not in allowed roles', () => {
            const context: AuthorizedContext = {
                user: { id: 'user-1', restaurantId: 'rest-1', role: 'waiter' },
                token: 'token',
                guestSession: null,
                dataLoaders: mockDataLoaders,
            };

            expect(() => requireRole(context, ['admin', 'manager'])).toThrow(GraphQLError);

            try {
                requireRole(context, ['admin', 'manager']);
            } catch (error) {
                expect(error).toBeInstanceOf(GraphQLError);
                expect((error as GraphQLError).extensions?.code).toBe('FORBIDDEN');
                expect(
                    ((error as GraphQLError).extensions?.http as { status?: number })?.status
                ).toBe(403);
                expect((error as GraphQLError).extensions?.requiredRoles).toEqual([
                    'admin',
                    'manager',
                ]);
            }
        });

        it('should throw FORBIDDEN when user has no role', () => {
            const context: AuthorizedContext = {
                user: { id: 'user-1', restaurantId: 'rest-1' },
                token: 'token',
                guestSession: null,
                dataLoaders: mockDataLoaders,
            };

            expect(() => requireRole(context, ['admin'])).toThrow(GraphQLError);

            try {
                requireRole(context, ['admin']);
            } catch (error) {
                expect(error).toBeInstanceOf(GraphQLError);
                expect((error as GraphQLError).extensions?.code).toBe('FORBIDDEN');
            }
        });

        it('should throw FORBIDDEN when user role is null', () => {
            const context: AuthorizedContext = {
                user: { id: 'user-1', restaurantId: 'rest-1', role: null },
                token: 'token',
                guestSession: null,
                dataLoaders: mockDataLoaders,
            } as unknown as AuthorizedContext;

            expect(() => requireRole(context, ['admin'])).toThrow(GraphQLError);
        });

        it('should throw FORBIDDEN when user role is undefined', () => {
            const context: AuthorizedContext = {
                user: { id: 'user-1', restaurantId: 'rest-1', role: undefined },
                token: 'token',
                guestSession: null,
                dataLoaders: mockDataLoaders,
            } as unknown as AuthorizedContext;

            expect(() => requireRole(context, ['admin'])).toThrow(GraphQLError);
        });

        it('should include requiredRoles in error extensions', () => {
            const context: AuthorizedContext = {
                user: { id: 'user-1', restaurantId: 'rest-1', role: 'waiter' },
                token: 'token',
                guestSession: null,
                dataLoaders: mockDataLoaders,
            };

            try {
                requireRole(context, ['admin', 'manager']);
            } catch (error) {
                expect((error as GraphQLError).extensions?.requiredRoles).toEqual([
                    'admin',
                    'manager',
                ]);
            }
        });
    });
});
