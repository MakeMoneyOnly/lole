// Apollo Server Configuration for lole GraphQL API
// Note: This is a placeholder. For production, use Apollo Router.
// Federation schemas are defined in graphql/subgraphs/ and published via CI.

// Placeholder - GraphQL API will be served via Apollo Router
// See router/ directory for the federated gateway configuration

export async function createApolloServer(): Promise<null> {
    // Disabled - GraphQL federation is handled by Apollo Router
    // The subgraph schemas are in graphql/subgraphs/ and published to Apollo GraphOS
    return null;
}

export const apolloServerDisabled = true;
