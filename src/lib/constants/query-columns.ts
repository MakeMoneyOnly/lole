/**
 * MED-001: Explicit column selections for frequently used queries
 * Replaces SELECT * with explicit column lists to:
 * - Reduce over-fetching and network transfer
 * - Prevent schema changes from exposing unexpected columns
 * - Improve query performance with covering indexes
 */

// ============================================
// ORDERS TABLE COLUMNS
// ============================================

/**
 * Columns for order list views (minimal fields for display)
 */
export const ORDER_LIST_COLUMNS = [
    'id',
    'restaurant_id',
    'table_number',
    'order_number',
    'status',
    'order_type',
    'total_price',
    'discount_amount',
    'created_at',
    'updated_at',
] as const;

/**
 * Columns for full order details (includes all fields)
 */
export const ORDER_DETAIL_COLUMNS = [
    'id',
    'restaurant_id',
    'table_number',
    'order_number',
    'status',
    'order_type',
    'total_price',
    'discount_amount',
    'notes',
    'guest_fingerprint',
    'staff_id',
    'items',
    'fire_mode',
    'idempotency_key',
    'created_at',
    'updated_at',
] as const;

/**
 * Columns for KDS display (kitchen-focused fields)
 */
export const ORDER_KDS_COLUMNS = [
    'id',
    'restaurant_id',
    'table_number',
    'order_number',
    'status',
    'order_type',
    'fire_mode',
    'created_at',
] as const;

// ============================================
// ORDER_ITEMS TABLE COLUMNS
// ============================================

/**
 * Columns for order item list views
 */
export const ORDER_ITEM_LIST_COLUMNS = [
    'id',
    'restaurant_id',
    'order_id',
    'item_id',
    'name',
    'quantity',
    'price',
    'modifiers',
    'notes',
    'status',
    'station',
    'course',
    'created_at',
] as const;

/**
 * Columns for KDS order items (kitchen-focused)
 */
export const ORDER_ITEM_KDS_COLUMNS = [
    'id',
    'order_id',
    'item_id',
    'name',
    'quantity',
    'modifiers',
    'notes',
    'status',
    'station',
    'course',
    'created_at',
] as const;

// ============================================
// MENU_ITEMS TABLE COLUMNS
// ============================================

/**
 * Columns for menu item list views (minimal fields)
 */
export const MENU_ITEM_LIST_COLUMNS = [
    'id',
    'restaurant_id',
    'category_id',
    'name',
    'name_am',
    'price',
    'image_url',
    'is_available',
    'preparation_time_minutes',
    'dietary_tags',
    'station',
    'connected_stations',
    'course',
    'created_at',
] as const;

/**
 * Columns for full menu item details
 */
export const MENU_ITEM_DETAIL_COLUMNS = [
    'id',
    'restaurant_id',
    'category_id',
    'name',
    'name_am',
    'description',
    'description_am',
    'price',
    'image_url',
    'is_available',
    'preparation_time_minutes',
    'dietary_tags',
    'station',
    'connected_stations',
    'course',
    'sort_order',
    'created_at',
    'updated_at',
] as const;

// ============================================
// CATEGORIES TABLE COLUMNS
// ============================================

/**
 * Columns for category list views
 */
export const CATEGORY_LIST_COLUMNS = [
    'id',
    'restaurant_id',
    'name',
    'name_am',
    'description',
    'image_url',
    'sort_order',
    'is_active',
    'created_at',
] as const;

// ============================================
// MODIFIER_GROUPS TABLE COLUMNS
// ============================================

/**
 * Columns for modifier group list views
 */
export const MODIFIER_GROUP_COLUMNS = [
    'id',
    'restaurant_id',
    'menu_item_id',
    'name',
    'name_am',
    'is_required',
    'min_selections',
    'max_selections',
    'is_active',
    'sort_order',
] as const;

// ============================================
// MODIFIER_OPTIONS TABLE COLUMNS
// ============================================

/**
 * Columns for modifier option list views
 */
export const MODIFIER_OPTION_COLUMNS = [
    'id',
    'restaurant_id',
    'modifier_group_id',
    'name',
    'name_am',
    'price_adjustment',
    'is_available',
    'sort_order',
] as const;

// ============================================
// TABLES TABLE COLUMNS
// ============================================

/**
 * Columns for table list views
 */
export const TABLE_LIST_COLUMNS = [
    'id',
    'restaurant_id',
    'table_number',
    'capacity',
    'status',
    'current_session_id',
    'position_x',
    'position_y',
    'created_at',
] as const;

// ============================================
// PAYMENTS TABLE COLUMNS
// ============================================

/**
 * Columns for payment list views
 */
export const PAYMENT_LIST_COLUMNS = [
    'id',
    'restaurant_id',
    'order_id',
    'amount',
    'currency',
    'provider',
    'status',
    'payment_method',
    'transaction_id',
    'created_at',
    'updated_at',
] as const;

/**
 * Columns for full payment details
 */
export const PAYMENT_DETAIL_COLUMNS = [
    'id',
    'restaurant_id',
    'order_id',
    'amount',
    'currency',
    'provider',
    'status',
    'payment_method',
    'transaction_id',
    'metadata',
    'idempotency_key',
    'created_at',
    'updated_at',
] as const;

// ============================================
// GUESTS TABLE COLUMNS
// ============================================

/**
 * Columns for guest list views
 */
export const GUEST_LIST_COLUMNS = [
    'id',
    'restaurant_id',
    'name',
    'phone',
    'email',
    'visit_count',
    'total_spent',
    'last_visit_at',
    'created_at',
] as const;

/**
 * Columns for full guest details
 */
export const GUEST_DETAIL_COLUMNS = [
    'id',
    'restaurant_id',
    'name',
    'phone',
    'email',
    'notes',
    'tags',
    'visit_count',
    'total_spent',
    'first_visit_at',
    'last_visit_at',
    'created_at',
    'updated_at',
] as const;

// ============================================
// RESTAURANT_STAFF TABLE COLUMNS
// ============================================

/**
 * Columns for staff list views
 */
export const STAFF_LIST_COLUMNS = [
    'id',
    'restaurant_id',
    'user_id',
    'role',
    'is_active',
    'created_at',
    'updated_at',
    'name',
    'pin_code',
    'assigned_zones',
] as const;

/**
 * Columns for full staff details
 */
export const STAFF_DETAIL_COLUMNS = [
    'id',
    'restaurant_id',
    'user_id',
    'name',
    'email',
    'phone',
    'role',
    'is_active',
    'pin_code',
    'assigned_zones',
    'created_at',
    'updated_at',
] as const;

// ============================================
// EXTERNAL_ORDERS TABLE COLUMNS
// ============================================

/**
 * Columns for external order list views
 */
export const EXTERNAL_ORDER_LIST_COLUMNS = [
    'id',
    'restaurant_id',
    'provider',
    'external_order_id',
    'normalized_status',
    'payload_json',
    'created_at',
    'updated_at',
] as const;

// ============================================
// TYPE HELPERS
// ============================================

/**
 * Helper type to convert readonly array to union type
 */
export type ColumnsFromList<T extends readonly string[]> = T[number];

/**
 * Helper function to join columns for Supabase select
 */
export function columnsToString(columns: readonly string[]): string {
    return columns.join(',');
}
