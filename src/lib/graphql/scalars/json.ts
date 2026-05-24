import { GraphQLScalarType, GraphQLError, Kind } from 'graphql';

const MAX_JSON_SIZE = 10240; // 10KB

export const JSONScalar = new GraphQLScalarType({
    name: 'JSON',
    description: 'JSON value with size validation. Maximum size is 10KB.',

    serialize(value: unknown) {
        // Output: Convert internal value to JSON for response
        return value;
    },

    parseValue(value: unknown) {
        // Input: Validate value from variables
        // Validate size
        const stringified = JSON.stringify(value);
        if (stringified.length > MAX_JSON_SIZE) {
            throw new GraphQLError(`JSON value exceeds maximum size of ${MAX_JSON_SIZE} bytes`, {
                extensions: { code: 'BAD_USER_INPUT', maxSize: MAX_JSON_SIZE },
            });
        }

        // Validate it's a valid JSON-serializable value
        if (
            value !== null &&
            typeof value !== 'object' &&
            typeof value !== 'string' &&
            typeof value !== 'number' &&
            typeof value !== 'boolean' &&
            !Array.isArray(value)
        ) {
            throw new GraphQLError('Invalid JSON value: must be a valid JSON type');
        }

        return value;
    },

    parseLiteral(ast) {
        // Input: Parse from query document literal
        if (ast.kind === Kind.STRING) {
            try {
                return JSON.parse(ast.value);
            } catch {
                throw new GraphQLError('Invalid JSON string');
            }
        }

        if (ast.kind === Kind.INT) {
            return parseInt(ast.value, 10);
        }

        if (ast.kind === Kind.FLOAT) {
            return parseFloat(ast.value);
        }

        if (ast.kind === Kind.BOOLEAN) {
            return ast.value;
        }

        if (ast.kind === Kind.NULL) {
            return null;
        }

        if (ast.kind === Kind.LIST || ast.kind === Kind.OBJECT) {
            // For lists and objects, validate size
            const stringified = JSON.stringify(ast);
            if (stringified.length > MAX_JSON_SIZE) {
                throw new GraphQLError(
                    `JSON value exceeds maximum size of ${MAX_JSON_SIZE} bytes`,
                    { extensions: { code: 'BAD_USER_INPUT', maxSize: MAX_JSON_SIZE } }
                );
            }
            return ast;
        }

        throw new GraphQLError(`Unexpected literal type: ${ast.kind}`);
    },
});
