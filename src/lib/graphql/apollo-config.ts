// Shared Apollo Server Configuration for Subgraphs
// Provides query depth limiting, complexity analysis, CSRF prevention, and secure error formatting
// This addresses CRITICAL-004 from the GraphQL Security Audit

import { ApolloServer } from '@apollo/server';
import { GraphQLError, ValidationContext, ASTVisitor } from 'graphql';
import { buildSubgraphSchema } from '@apollo/subgraph';
import gql from 'graphql-tag';
import type { GraphQLContext } from './context';
import { graphqlConfig } from './config';
import { logger } from '@/lib/logger';

const log = logger.child('[graphql/apollo-config]');

export interface SubgraphConfig {
    typeDefs: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolvers: any;
}

const DEPTH_LIMIT = 10;
const COMPLEXITY_LIMIT = 1000;

// Type definitions for AST traversal
interface ASTNode {
    kind: string;
    name?: { value: string };
    selectionSet?: { selections: ASTNode[] };
    definitions?: ASTNode[];
    operation?: string;
    arguments?: unknown[];
    [key: string]: unknown;
}

/**
 * Depth limit validation rule to prevent deeply nested queries
 * that could cause DoS through excessive resource consumption
 */
function depthLimitRule(maxDepth: number): (context: ValidationContext) => ASTVisitor {
    return (context: ValidationContext) =>
        ({
            Document(node: ASTNode) {
                const checkDepth = (node: ASTNode, currentDepth: number): number => {
                    if (currentDepth > maxDepth) {
                        context.reportError(
                            new GraphQLError(
                                `Query depth ${currentDepth} exceeds maximum allowed ${maxDepth}`,
                                { extensions: { code: 'BAD_USER_INPUT' } }
                            )
                        );
                        return currentDepth;
                    }

                    let maxChildDepth = currentDepth;

                    if (node.selectionSet) {
                        for (const selection of node.selectionSet.selections) {
                            const childDepth = checkDepth(selection, currentDepth + 1);
                            maxChildDepth = Math.max(maxChildDepth, childDepth);
                        }
                    }

                    return maxChildDepth;
                };

                if (node.definitions) {
                    for (const definition of node.definitions) {
                        checkDepth(definition, 0);
                    }
                }
            },
        }) as ASTVisitor;
}

/**
 * Complexity limit validation rule to prevent expensive queries
 * Uses field-level complexity weights:
 * - Base query fields: 1 point
 * - Mutation fields: 10 points (mutations are more expensive)
 * - Connection/list fields with arguments: 5 points (potential for large datasets)
 * - Nested/object fields: 2 points
 */
function complexityLimitRule(maxComplexity: number): (context: ValidationContext) => ASTVisitor {
    return (context: ValidationContext) => {
        let totalComplexity = 0;
        let isMutation = false;

        // Fields that are considered expensive (connections, lists with pagination)
        const expensiveFieldNames = [
            'orders',
            'items',
            'menuItems',
            'products',
            'transactions',
            'payments',
            'sessions',
            'guests',
            'staff',
            'notifications',
            'connections',
            'edges',
            'nodes',
            'list',
            'all',
            'search',
            'query',
        ];

        // Fields that are mutations
        const mutationFieldNames = [
            'createOrder',
            'updateOrder',
            'cancelOrder',
            'deleteOrder',
            'createPayment',
            'updatePayment',
            'refundPayment',
            'createSession',
            'closeSession',
            'createGuest',
            'updateGuest',
            'createStaff',
            'updateStaff',
            'deleteStaff',
            'createMenuItem',
            'updateMenuItem',
            'deleteMenuItem',
            'toggleHappyHour',
            'applyDiscount',
            'splitBill',
            'assignTable',
        ];

        return {
            OperationDefinition(node: ASTNode) {
                // Track if this operation is a mutation
                isMutation = node.operation === 'mutation';
            },
            Field(node: ASTNode): ASTNode | undefined {
                const fieldName = node.name?.value?.toLowerCase() || '';

                // Determine complexity weight based on field type
                let fieldWeight = 1; // Default base weight for simple query fields

                // Mutations are 10x more expensive than queries
                if (isMutation) {
                    fieldWeight = 10;
                }
                // Check if this is a known mutation field
                else if (mutationFieldNames.some(name => fieldName.includes(name.toLowerCase()))) {
                    fieldWeight = 10;
                }
                // Check if this is an expensive field (potential large dataset)
                else if (expensiveFieldNames.some(name => fieldName.includes(name))) {
                    // If the field has arguments (like pagination), it's more expensive
                    const args = node.arguments as unknown[] | undefined;
                    if (args && args.length > 0) {
                        fieldWeight = 5;
                    } else {
                        fieldWeight = 3;
                    }
                }
                // Check if field returns an object type (nested query)
                else if (node.selectionSet) {
                    fieldWeight = 2;
                }

                totalComplexity += fieldWeight;
                return undefined;
            },
            Document: {
                leave(_node: ASTNode) {
                    if (totalComplexity > maxComplexity) {
                        context.reportError(
                            new GraphQLError(
                                `Query complexity ${totalComplexity} exceeds maximum allowed ${maxComplexity}`,
                                { extensions: { code: 'BAD_USER_INPUT' } }
                            )
                        );
                    }
                },
            },
        } as ASTVisitor;
    };
}

/**
 * Creates a configured Apollo Server instance for subgraphs
 * with security features enabled
 */
export function createSubgraphServer(config: SubgraphConfig): ApolloServer<GraphQLContext> {
    const schema = buildSubgraphSchema({
        typeDefs: gql(config.typeDefs),
        resolvers: config.resolvers,
    });

    return new ApolloServer<GraphQLContext>({
        schema,
        introspection: graphqlConfig.introspection,

        // Add validation rules for security
        validationRules: [depthLimitRule(DEPTH_LIMIT), complexityLimitRule(COMPLEXITY_LIMIT)],

        // Enable CSRF prevention
        csrfPrevention: true,

        // Configure error formatting
        formatError: (formattedError, error) => {
            // Log internal errors for debugging
            if (formattedError.extensions?.code === 'INTERNAL_SERVER_ERROR') {
                log.error('GraphQL Internal Error', error);
            }

            // Don't expose internal errors to clients in production
            if (process.env.NODE_ENV === 'production') {
                if (!formattedError.extensions?.code) {
                    return new GraphQLError('Internal server error', {
                        extensions: { code: 'INTERNAL_SERVER_ERROR' },
                    });
                }
            }

            return formattedError;
        },
    });
}
