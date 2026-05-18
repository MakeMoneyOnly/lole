/**
 * Centralized Status Types
 *
 * This file is the single source of truth for all status enums.
 * Import from here instead of defining locally.
 *
 * @see SKILLS/productivity/reducing-entropy/SKILL.md - Reduce duplication
 */

import { z } from 'zod';

// ============================================================================
// Order Status
// ============================================================================

export const ORDER_STATUSES = [
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'served',
    'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const orderStatusSchema = z.enum(ORDER_STATUSES);

// ============================================================================
// Payment Status
// ============================================================================

export const PAYMENT_STATUSES = [
    'pending',
    'processing',
    'captured',
    'failed',
    'refunded',
    'cancelled',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);

// ============================================================================
// KDS Item Status
// ============================================================================

export const KDS_ITEM_STATUSES = [
    'pending',
    'fired',
    'preparing',
    'ready',
    'served',
    'cancelled',
] as const;
export type KdsItemStatus = (typeof KDS_ITEM_STATUSES)[number];
export const kdsItemStatusSchema = z.enum(KDS_ITEM_STATUSES);

// ============================================================================
// Table Session Status
// ============================================================================

export const TABLE_SESSION_STATUSES = ['seated', 'ordering', 'dining', 'paying', 'closed'] as const;
export type TableSessionStatus = (typeof TABLE_SESSION_STATUSES)[number];
export const tableSessionStatusSchema = z.enum(TABLE_SESSION_STATUSES);

// ============================================================================
// Order Item Status
// ============================================================================

export const ORDER_ITEM_STATUSES = [
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'served',
    'cancelled',
] as const;
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number];
export const orderItemStatusSchema = z.enum(ORDER_ITEM_STATUSES);

// ============================================================================
// Device Status
// ============================================================================

export const DEVICE_STATUSES = ['pending', 'active', 'inactive', 'revoked'] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];
export const deviceStatusSchema = z.enum(DEVICE_STATUSES);

// ============================================================================
// Staff Role
// ============================================================================

/**
 * Canonical staff roles - single source of truth.
 * Used across database, API, and frontend.
 */
export const STAFF_ROLES = ['owner', 'admin', 'manager', 'kitchen', 'waiter', 'bar'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export const staffRoleSchema = z.enum(STAFF_ROLES);
