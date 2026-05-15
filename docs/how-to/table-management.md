# How to Manage Tables, QR Codes, and Sessions

**Version 1.0 · May 2026 · Goal-Oriented Guide**

> This guide provides step-by-step instructions for managing restaurant tables, QR codes, and table sessions in lole.

---

## Overview

Table management is critical for dine-in operations. This guide covers:

- Creating and configuring tables
- Managing QR codes for table ordering
- Handling table sessions and billing

---

## Problem: Need to Add New Tables to Restaurant

### Step 1: Access Table Management

1. Log into the lole Dashboard as Owner or Manager
2. Navigate to **Settings** → **Tables**
3. Click **Add Table**

### Step 2: Configure Table Details

| Field        | Required | Description                                |
| ------------ | -------- | ------------------------------------------ |
| Table Number | Yes      | Unique identifier (e.g., "A1", "B3", "12") |
| Label        | No       | Display name for guests                    |
| Capacity     | No       | Maximum seats                              |
| Section      | No       | "Indoor", "Outdoor", "Terrace"             |

**Example:**

```
Table Number: T05
Label: Table 5 (Window)
Capacity: 4
Section: Indoor
```

### Step 3: Verify Table Creation

```sql
-- Check tables in database
SELECT id, table_number, label, capacity, section
FROM tables
WHERE restaurant_id = '<restaurant_id>'
ORDER BY table_number;
```

---

## Problem: QR Code Not Working

### Diagnosis Steps

#### Step 1: Check Table Status

```sql
-- Verify table exists and is active
SELECT id, table_number, is_active
FROM tables
WHERE id = '<table_id>';
```

If `is_active = false`, the QR code returns a 404.

#### Step 2: Generate New QR Code

1. In Dashboard, go to **Settings** → **Tables**
2. Find the table and click **Regenerate QR**
3. Download the new QR code image

#### Step 3: Test QR Code

1. Scan QR with mobile device
2. Should open: `https://lole.app/menu/<restaurant_slug>?table=<table_id>`
3. Menu should load within 3 seconds

### Resolution

If QR fails:

1. **Check URL format:**

    ```
    Correct: https://lole.app/menu/lucia-cafe?table=abc-123
    Wrong: https://lole.app/menu/lucia-cafe/table/abc-123
    ```

2. **Verify restaurant slug:**

    ```sql
    SELECT slug FROM restaurants WHERE id = '<restaurant_id>';
    ```

3. **Clear browser cache** on device and retry

---

## Problem: Table Session Won't Close

### Diagnosis

#### Step 1: Check Session Status

```sql
-- Find open sessions
SELECT
  ts.id,
  t.table_number,
  ts.opened_at,
  ts.closed_at,
  ts.order_count
FROM table_sessions ts
JOIN tables t ON t.id = ts.table_id
WHERE ts.restaurant_id = '<restaurant_id>'
AND ts.closed_at IS NULL;
```

#### Step 2: Check for Pending Orders

```sql
-- Check for incomplete orders in session
SELECT o.order_number, o.status, o.total_price
FROM orders o
JOIN table_sessions ts ON ts.id = o.table_session_id
WHERE ts.id = '<session_id>'
AND o.status NOT IN ('served', 'cancelled');
```

### Resolution

#### Option A: Close Session Normally

1. Complete all orders (mark as "served")
2. On POS, go to **Tables** → Select table → **Close Session**
3. Print receipt if needed

#### Option B: Force Close Session

```sql
-- Only if orders are truly complete
UPDATE table_sessions
SET closed_at = NOW(),
    revenue_santim = (
      SELECT SUM(total_price)
      FROM orders
      WHERE table_session_id = '<session_id>'
      AND status IN ('served', 'ready')
    ),
    order_count = (
      SELECT COUNT(*)
      FROM orders
      WHERE table_session_id = '<session_id>'
    )
WHERE id = '<session_id>'
AND closed_at IS NULL;
```

---

## Problem: Guest Can't Access Menu via QR

### Diagnosis Steps

#### Step 1: Verify Restaurant Status

```sql
SELECT is_active FROM restaurants WHERE id = '<restaurant_id>';
```

Restaurant must be `is_active = true`.

#### Step 2: Check Menu Items

```sql
-- Verify active menu items exist
SELECT COUNT(*) as active_items
FROM menu_items
WHERE restaurant_id = '<restaurant_id>'
AND is_available = true;
```

#### Step 3: Verify Restaurant Online

1. Check network connectivity
2. Visit `https://lole.app/api/health`
3. Status should return `200 OK`

### Resolution

1. **If restaurant inactive:**
    - Activate in Dashboard → Restaurant Settings

2. **If no menu items:**
    - Add menu items in Dashboard → Menu

3. **If API down:**
    - Wait for recovery (typically < 5 minutes)
    - Use backup: verbal ordering to staff

---

## Problem: Need to Reset Table for New Guests

### Complete Reset Procedure

#### Step 1: Close Current Session

```sql
UPDATE table_sessions
SET closed_at = NOW()
WHERE table_id = '<table_id>'
AND closed_at IS NULL;
```

#### Step 2: Clear Guest Session Data

```sql
-- End any active guest sessions
UPDATE guest_menu_sessions
SET ended_at = NOW(),
    is_active = false
WHERE table_id = '<table_id>'
AND is_active = true;
```

#### Step 3: Create New Session

On POS, select table → **Start New Session**

---

## Problem: QR Code Scanning Creates Duplicate Sessions

### Diagnosis

```sql
-- Check for overlapping sessions
SELECT
  ts.id,
  t.table_number,
  ts.opened_at,
  ts.closed_at,
  EXTRACT(EPOCH FROM (ts.closed_at - ts.opened_at))/60 as duration_minutes
FROM table_sessions ts
JOIN tables t ON t.id = ts.table_id
WHERE ts.table_id = '<table_id>'
ORDER BY ts.opened_at DESC
LIMIT 5;
```

### Resolution

1. **Merge duplicate sessions:**
    - Keep the earliest session
    - Cancel orders from duplicate sessions
    - Transfer valid orders to correct session

2. **Prevention:**
    - Train guests to close browser after ordering
    - Set session timeout (Dashboard → Settings → Sessions → Auto-close after 4 hours)

---

## Problem: Table Revenue Calculation Mismatch

### Verification Steps

```sql
-- Calculate expected revenue
SELECT
  ts.id as session_id,
  COUNT(o.id) as actual_order_count,
  SUM(o.total_price) as calculated_revenue,
  ts.order_count as recorded_order_count,
  ts.revenue_santim as recorded_revenue
FROM table_sessions ts
LEFT JOIN orders o ON o.table_session_id = ts.id
  AND o.status IN ('served', 'ready')
WHERE ts.id = '<session_id>'
GROUP BY ts.id, ts.order_count, ts.revenue_santim;
```

### Resolution

```sql
-- Sync session totals with actual orders
UPDATE table_sessions
SET
  order_count = sub.order_count,
  revenue_santim = sub.revenue_santim
FROM (
  SELECT
    COUNT(*) as order_count,
    SUM(total_price) as revenue_santim
  FROM orders
  WHERE table_session_id = '<session_id>'
  AND status IN ('served', 'ready')
) sub
WHERE id = '<session_id>';
```

---

## Problem: Cannot Delete Table (Has Orders)

### Resolution

Tables cannot be deleted if they have historical orders. Instead:

1. **Deactivate the table:**

    ```sql
    UPDATE tables
    SET is_active = false
    WHERE id = '<table_id>';
    ```

2. **The table will no longer appear for new sessions**

3. **Historical data remains intact for reporting**

---

## Verification Checklist

After any table operation:

- [ ] Table appears correctly in POS table list
- [ ] QR code scans to correct menu URL
- [ ] New session creates successfully
- [ ] Orders assign to correct table
- [ ] Session closes and calculates revenue

---

## Related Documentation

- [KDS Printer Failures Runbook](../operations/runbooks/kds-printer-failures.md)
- [Database Schema Reference](../reference/architecture/database-schema.md)
- [Local Development Setup](../tutorials/local-development.md)
