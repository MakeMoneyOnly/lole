# How to Troubleshoot Order Issues

**Version 1.0 · May 2026 · Goal-Oriented Guide**

> This guide provides step-by-step troubleshooting for common order issues in lole, including missing orders, stuck statuses, and pricing problems.

---

## Overview

Order issues disrupt restaurant operations. This guide helps identify and resolve:

- Missing or delayed orders
- Stuck order statuses
- Pricing and item discrepancies
- KDS display problems

---

## Problem: Order Not Appearing on KDS

### Diagnosis Steps

#### Step 1: Check Order Status

```sql
-- Find the specific order
SELECT
  id, order_number, status, created_at,
  table_id, table_session_id
FROM orders
WHERE order_number = '<order_number>'
OR id = '<order_id>';
```

**Expected status values:**

- `pending` - Order created, awaiting confirmation
- `confirmed` - Confirmed by kitchen
- `preparing` - Kitchen is preparing
- `ready` - Ready for pickup/delivery
- `served` - Order delivered to guest
- `cancelled` - Order cancelled

#### Step 2: Verify KDS Station Routing

```sql
-- Check order items and their stations
SELECT
  oi.id,
  mi.name,
  oi.kds_station,
  oi.status as item_status
FROM order_items oi
JOIN menu_items mi ON mi.id = oi.menu_item_id
WHERE oi.order_id = '<order_id>';
```

#### Step 3: Check Realtime Connection

```javascript
// In browser console on KDS page
supabase.getChannel('kds-orders').state; // Should be 'joined'
```

### Resolution

1. **If status is 'pending':**
    - Kitchen staff should click **Confirm** on POS/KDS
    - Orders stay pending for 2 minutes before auto-timeout

2. **If item missing kds_station:**

    ```sql
    -- Fix missing station (use category default)
    UPDATE order_items oi
    SET kds_station = c.kds_station
    FROM menu_items mi
    JOIN categories c ON c.id = mi.category_id
    WHERE oi.id = '<order_item_id>'
    AND oi.kds_station IS NULL;
    ```

3. **If realtime disconnected:**
    - Refresh KDS page
    - Check network connectivity

---

## Problem: Order Stuck in 'Pending' Status

### Diagnosis Steps

#### Step 1: Check Order Age

```sql
SELECT
  order_number,
  created_at,
  NOW() - created_at as age
FROM orders
WHERE status = 'pending'
AND created_at < NOW() - INTERVAL '5 minutes';
```

Orders older than 5 minutes in pending status need intervention.

#### Step 2: Check for Errors

```sql
-- Look for failed items
SELECT
  oi.id,
  mi.name,
  oi.status,
  oi.notes
FROM order_items oi
JOIN menu_items mi ON mi.id = oi.menu_item_id
WHERE oi.order_id = '<order_id>'
AND oi.status = 'failed';
```

### Resolution

#### Option A: Force Confirm Order

```sql
BEGIN;
-- Update order status
UPDATE orders
SET status = 'confirmed',
    updated_at = NOW()
WHERE id = '<order_id>'
AND status = 'pending';

-- Update all items to confirmed
UPDATE order_items
SET status = 'pending',  -- Items stay pending until kitchen starts
    updated_at = NOW()
WHERE order_id = '<order_id>';
COMMIT;
```

#### Option B: Cancel and Reorder

1. Cancel the stuck order:

    ```sql
    UPDATE orders
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE id = '<order_id>';
    ```

2. Create new order through POS

---

## Problem: Order Items Not Showing Correct Price

### Diagnosis Steps

#### Step 1: Check Menu Item Pricing

```sql
SELECT
  mi.id,
  mi.name,
  mi.price as current_price,
  oi.unit_price as ordered_price,
  oi.quantity,
  (oi.unit_price * oi.quantity) as calculated_total,
  oi.item_total as stored_total
FROM order_items oi
JOIN menu_items mi ON mi.id = oi.menu_item_id
WHERE oi.id = '<order_item_id>';
```

#### Step 2: Check Modifier Prices

```sql
-- Check modifiers applied to item
SELECT
  oi.modifiers,
  (oi.modifiers->>'total_adjustment')::INTEGER as modifier_adjustment
FROM order_items oi
WHERE oi.id = '<order_item_id>';
```

### Resolution

#### If Price Changed After Order

This is expected behavior. Order prices are locked at time of order. No action needed unless:

1. **Order total incorrect:**

    ```sql
    -- Recalculate item total
    UPDATE order_items
    SET item_total = quantity * unit_price
    WHERE id = '<order_item_id>';
    ```

2. **Order grand total incorrect:**
    ```sql
    -- Recalculate order total
    WITH item_totals AS (
      SELECT order_id, SUM(item_total) as new_total
      FROM order_items
      WHERE order_id = '<order_id>'
      GROUP BY order_id
    )
    UPDATE orders o
    SET total_price = it.new_total
    FROM item_totals it
    WHERE o.id = it.order_id;
    ```

---

## Problem: Order Won't Cancel

### Diagnosis

```sql
-- Check order status and dependencies
SELECT
  o.status,
  COUNT(p.id) as payments_count,
  COUNT(oi.id) as items_count
FROM orders o
LEFT JOIN payments p ON p.order_id = o.id
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE o.id = '<order_id>'
GROUP BY o.status;
```

### Resolution

#### Pre-conditions for Cancellation

1. **No captured payments:**

    ```sql
    -- Check payment status
    SELECT id, status, amount
    FROM payments
    WHERE order_id = '<order_id>'
    AND status = 'captured';
    ```

2. **If captured payment exists:**
    - Process refund first
    - Then cancel order

#### Cancel Order

```sql
BEGIN;
-- Cancel all order items
UPDATE order_items
SET status = 'cancelled',
    updated_at = NOW()
WHERE order_id = '<order_id>';

-- Cancel the order
UPDATE orders
SET status = 'cancelled',
    updated_at = NOW()
WHERE id = '<order_id>'
AND status NOT IN ('served', 'cancelled');

-- If order was already confirmed, add back inventory
-- (handled by trigger, but verify manually if needed)
COMMIT;
```

---

## Problem: Wrong Items on Order

### Diagnosis Steps

#### Step 1: Review Order Details

```sql
SELECT
  o.order_number,
  o.created_at,
  oi.id as item_id,
  mi.name,
  oi.quantity,
  oi.notes
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN menu_items mi ON mi.id = oi.menu_item_id
WHERE o.id = '<order_id>';
```

#### Step 2: Check Order Source

```sql
-- Was it guest or staff ordered?
SELECT
  o.id,
  o.guest_id,
  o.staff_id,
  CASE
    WHEN o.guest_id IS NOT NULL THEN 'Guest QR Order'
    WHEN o.staff_id IS NOT NULL THEN 'Staff POS Order'
    ELSE 'Unknown'
  END as order_source
FROM orders o
WHERE o.id = '<order_id>';
```

### Resolution Options

#### Option A: Edit Order (if pending/confirmed)

1. Add missing items:

    ```sql
    INSERT INTO order_items (
      id, restaurant_id, order_id, menu_item_id,
      quantity, unit_price, status, idempotency_key
    ) VALUES (
      gen_random_uuid(), '<restaurant_id>', '<order_id>',
      '<menu_item_id>', 1, '<price>', 'pending',
      '<unique_idempotency_key>'
    );
    ```

2. Remove wrong items:

    ```sql
    UPDATE order_items
    SET status = 'cancelled'
    WHERE id = '<wrong_item_id>';
    ```

3. Update order total:
    ```sql
    UPDATE orders
    SET total_price = (
      SELECT SUM(quantity * unit_price)
      FROM order_items
      WHERE order_id = '<order_id>'
      AND status != 'cancelled'
    )
    WHERE id = '<order_id>';
    ```

---

## Related Documentation

- [KDS Troubleshooting Guide](./kds-troubleshooting.md)
- [Payment Troubleshooting Guide](./payment-troubleshooting.md)
- [Database Schema Reference](../reference/architecture/database-schema.md)
