// Menu Domain - Resolvers Layer
// Thin layer — maps GraphQL fields to repository calls

import { GraphQLError } from 'graphql';
import { menuRepository } from './repository';
import { GraphQLContext } from '@/lib/graphql/context';
import { requireAuth, requireRestaurantAccess, verifyTenantIsolation } from '@/lib/graphql/authz';
import {
    createErrorResult,
    handleResolverError,
    NOT_IMPLEMENTED_ERROR,
    NOT_FOUND_ERROR,
} from '@/lib/graphql/errors';
import {
    validateInput,
    CreateMenuItemInputSchema,
    UpdateMenuItemInputSchema,
} from '@/lib/validators/graphql';
import { JSONScalar } from '@/lib/graphql/scalars';
import { PAGINATION } from '@/lib/graphql/constants';
import { logger } from '@/lib/logger';

export const menuResolvers = {
    JSON: JSONScalar,
    Query: {
        menuItems: async (
            _: unknown,
            args: {
                restaurantId: string;
                categoryId?: string;
                availableOnly?: boolean;
            },
            context: GraphQLContext
        ) => {
            // Authorization: Verify user has access to this restaurant
            await requireRestaurantAccess(context, args.restaurantId);

            // Enforce maximum limit to prevent unbounded result sets
            // Note: Schema doesn't have pagination params, but we limit at repository level
            return menuRepository.getMenuItems(args.restaurantId, {
                categoryId: args.categoryId,
                availableOnly: args.availableOnly,
                limit: PAGINATION.MAX_PAGE_SIZE,
            });
        },

        menuItem: async (_: unknown, args: { id: string }, context: GraphQLContext) => {
            const authContext = requireAuth(context);
            const menuItem = await menuRepository.getMenuItem(args.id);

            // Verify tenant isolation - user can only access menu items from their restaurant
            if (menuItem && menuItem.restaurant_id !== authContext.user.restaurantId) {
                throw new GraphQLError('Access denied to this menu item', {
                    extensions: { code: 'FORBIDDEN', http: { status: 403 } },
                });
            }

            return menuItem;
        },

        categories: async (_: unknown, args: { restaurantId: string }, context: GraphQLContext) => {
            // Authorization: Verify user has access to this restaurant
            await requireRestaurantAccess(context, args.restaurantId);

            return menuRepository.getMenuCategories(args.restaurantId);
        },

        category: async (_: unknown, args: { id: string }, _context: GraphQLContext) => {
            // For now, return null - would need a getCategory method
            // This is a placeholder for federation reference resolution
            logger.warn('[menu/resolvers] category query called with id:', {
                id: args.id,
                source: '[menu/resolvers]',
            });
            return null;
        },

        searchMenu: async (
            _: unknown,
            args: { restaurantId: string; query: string },
            context: GraphQLContext
        ) => {
            // Authorization: Verify user has access to this restaurant
            await requireRestaurantAccess(context, args.restaurantId);

            // Use getMenuItems with client-side filtering for now
            // In production, this would use full-text search
            const items = await menuRepository.getMenuItems(args.restaurantId);
            const lowerQuery = args.query.toLowerCase();
            return items.filter(
                (item: Record<string, unknown>) =>
                    (item.name as string)?.toLowerCase().includes(lowerQuery) ||
                    (item.name_am as string)?.toLowerCase().includes(lowerQuery)
            );
        },
    },

    Mutation: {
        createMenuItem: async (_: unknown, args: { input: unknown }, context: GraphQLContext) => {
            try {
                // Validate input
                const validation = validateInput(CreateMenuItemInputSchema, args.input);
                if (!validation.success) {
                    return {
                        ...createErrorResult('VALIDATION_ERROR', validation.error),
                        menuItem: null,
                    };
                }

                // Authorization: Verify user has access to this restaurant
                await requireRestaurantAccess(context, validation.data.restaurantId);

                // Mutation not implemented in repository yet
                return {
                    ...NOT_IMPLEMENTED_ERROR,
                    menuItem: null,
                };
            } catch (error) {
                if (error instanceof GraphQLError) {
                    throw error;
                }
                return {
                    ...handleResolverError(error),
                    menuItem: null,
                };
            }
        },

        updateMenuItem: async (
            _: unknown,
            args: { id: string; input: unknown },
            context: GraphQLContext
        ) => {
            try {
                // Validate input (include id in validation)
                const validation = validateInput(UpdateMenuItemInputSchema, {
                    id: args.id,
                    ...(args.input as object),
                });
                if (!validation.success) {
                    return {
                        ...createErrorResult('VALIDATION_ERROR', validation.error),
                        menuItem: null,
                    };
                }

                const authContext = requireAuth(context);

                // Fetch the menu item to verify tenant isolation
                const existingItem = await menuRepository.getMenuItem(validation.data.id);
                if (!existingItem) {
                    return {
                        ...NOT_FOUND_ERROR,
                        menuItem: null,
                    };
                }

                // Verify tenant isolation
                verifyTenantIsolation(authContext, existingItem.restaurant_id as string);

                // Mutation not implemented in repository yet
                return {
                    ...NOT_IMPLEMENTED_ERROR,
                    menuItem: null,
                };
            } catch (error) {
                if (error instanceof GraphQLError) {
                    throw error;
                }
                return {
                    ...handleResolverError(error),
                    menuItem: null,
                };
            }
        },

        markItemAvailability: async (
            _: unknown,
            args: { id: string; available: boolean },
            context: GraphQLContext
        ) => {
            try {
                const authContext = requireAuth(context);

                // Fetch the menu item to verify tenant isolation
                const existingItem = await menuRepository.getMenuItem(args.id);
                if (!existingItem) {
                    return {
                        ...NOT_FOUND_ERROR,
                        menuItem: null,
                    };
                }

                // Verify tenant isolation
                verifyTenantIsolation(authContext, existingItem.restaurant_id as string);

                // Mutation not implemented in repository yet
                return {
                    ...NOT_IMPLEMENTED_ERROR,
                    menuItem: null,
                };
            } catch (error) {
                if (error instanceof GraphQLError) {
                    throw error;
                }
                return {
                    ...handleResolverError(error),
                    menuItem: null,
                };
            }
        },

        updateMenuItemPrice: async (
            _: unknown,
            args: { id: string; price: number },
            context: GraphQLContext
        ) => {
            try {
                const authContext = requireAuth(context);

                // Fetch the menu item to verify tenant isolation
                const existingItem = await menuRepository.getMenuItem(args.id);
                if (!existingItem) {
                    return {
                        ...NOT_FOUND_ERROR,
                        menuItem: null,
                    };
                }

                // Verify tenant isolation
                verifyTenantIsolation(authContext, existingItem.restaurant_id as string);

                // Mutation not implemented in repository yet
                return {
                    ...NOT_IMPLEMENTED_ERROR,
                    menuItem: null,
                };
            } catch (error) {
                if (error instanceof GraphQLError) {
                    throw error;
                }
                return {
                    ...handleResolverError(error),
                    menuItem: null,
                };
            }
        },
    },

    MenuItem: {
        __resolveReference: async (reference: { id: string }, context: GraphQLContext) => {
            const menuItem = await menuRepository.getMenuItem(reference.id);

            // Validate tenant isolation
            if (menuItem && context.user?.restaurantId) {
                if (menuItem.restaurant_id !== context.user.restaurantId) {
                    logger.error(
                        `[menu/resolvers] Tenant isolation violation: User ${context.user.id} attempted to access menu item ${reference.id}`,
                        undefined,
                        { source: '[menu/resolvers]' }
                    );
                    return null;
                }
            }

            return menuItem;
        },
        category: async (
            menuItem: Record<string, unknown>,
            _args: unknown,
            context: GraphQLContext
        ) => {
            const categoryId = menuItem.category_id as string | undefined;
            if (!categoryId) return null;
            return context.dataLoaders.categories.load(categoryId);
        },
        modifierGroups: async (
            menuItem: Record<string, unknown>,
            _args: unknown,
            context: GraphQLContext
        ) => {
            const id = menuItem.id as string;
            if (!id) return [];
            return context.dataLoaders.modifierGroups.load(id);
        },
    },

    Category: {
        __resolveReference: async (
            reference: { id: string },
            _args: unknown,
            context: GraphQLContext
        ) => {
            const category = await context.dataLoaders.categories.load(reference.id);

            // Validate tenant isolation
            if (category && context.user?.restaurantId) {
                if (category.restaurant_id !== context.user.restaurantId) {
                    logger.error(
                        `[menu/resolvers] Tenant isolation violation: User ${context.user.id} attempted to access category ${reference.id}`,
                        undefined,
                        { source: '[menu/resolvers]' }
                    );
                    return null;
                }
            }

            return category;
        },
        items: async (_category: Record<string, unknown>) => {
            // Would need getMenuItemsByCategory method
            return [];
        },
    },

    ModifierGroup: {
        __resolveReference: async (
            reference: { id: string },
            _args: unknown,
            context: GraphQLContext
        ) => {
            const modifierGroup = await context.dataLoaders.modifierGroup.load(reference.id);

            // Validate tenant isolation via parent menu item's restaurant_id
            // Modifier groups are linked to menu items, so we need to check the menu item's restaurant
            if (modifierGroup && context.user?.restaurantId) {
                // Get the parent menu item to check restaurant ownership
                const menuItemId = modifierGroup.menu_item_id as string | undefined;
                if (menuItemId) {
                    const menuItem = await context.dataLoaders.menuItems.load(menuItemId);
                    if (menuItem && menuItem.restaurant_id !== context.user.restaurantId) {
                        logger.error(
                            `[menu/resolvers] Tenant isolation violation: User ${context.user.id} attempted to access modifier group ${reference.id}`,
                            undefined,
                            { source: '[menu/resolvers]' }
                        );
                        return null;
                    }
                }
            }

            return modifierGroup;
        },
        options: async (
            group: Record<string, unknown>,
            _args: unknown,
            context: GraphQLContext
        ) => {
            const id = group.id as string;
            if (!id) return [];
            return context.dataLoaders.modifierOptions.load(id);
        },
    },

    ModifierOption: {
        __resolveReference: async (
            reference: { id: string },
            _args: unknown,
            context: GraphQLContext
        ) => {
            const modifierOption = await context.dataLoaders.modifierOption.load(reference.id);

            // Validate tenant isolation via parent modifier group -> menu item chain
            if (modifierOption && context.user?.restaurantId) {
                const modifierGroupId = modifierOption.modifier_group_id as string | undefined;
                if (modifierGroupId) {
                    const modifierGroup =
                        await context.dataLoaders.modifierGroup.load(modifierGroupId);
                    if (modifierGroup) {
                        const menuItemId = modifierGroup.menu_item_id as string | undefined;
                        if (menuItemId) {
                            const menuItem = await context.dataLoaders.menuItems.load(menuItemId);
                            if (menuItem && menuItem.restaurant_id !== context.user.restaurantId) {
                                logger.error(
                                    `[menu/resolvers] Tenant isolation violation: User ${context.user.id} attempted to access modifier option ${reference.id}`,
                                    undefined,
                                    { source: '[menu/resolvers]' }
                                );
                                return null;
                            }
                        }
                    }
                }
            }

            return modifierOption;
        },
    },
};
