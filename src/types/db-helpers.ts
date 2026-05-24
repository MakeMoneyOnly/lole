/**
 * Type Utilities for Common Transformations
 *
 * Provides helper functions for working with generated database types.
 * @see ADR-003: Database Type Inference
 */

import type { Database } from './database';

/**
 * Get a Row type from the generated Database type
 * @example
 * type Staff = DbRow<'staff'>
 */
export type DbRow<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Row'];

/**
 * Get an Insert type from the generated Database type
 * @example
 * type NewStaff = DbInsert<'staff'>
 */
export type DbInsert<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Insert'];

/**
 * Get an Update type from the generated Database type
 * @example
 * type StaffUpdate = DbUpdate<'staff'>
 */
export type DbUpdate<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Update'];

/**
 * Extract types from a table that has a Json column
 * Useful for getting the type of a JSON column's value
 */
export type JsonColumnType<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Row'][keyof Database['public']['Tables'][T]['Row']] extends infer U
        ? U extends JsonValue
            ? U
            : never
        : never;

type JsonValue =
    | string
    | number
    | boolean
    | null
    | { [key: string]: JsonValue | undefined }
    | JsonValue[];

/**
 * Nullable version of DbRow - useful for variables that may not be loaded yet
 */
export type NullableDbRow<T extends keyof Database['public']['Tables']> =
    | DbRow<T>
    | null
    | undefined;

/**
 * Array version of DbRow - useful for query results
 */
export type DbRowArray<T extends keyof Database['public']['Tables']> = DbRow<T>[];
