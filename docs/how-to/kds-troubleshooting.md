# How to Troubleshoot KDS Issues

**Version 1.0 · May 2026 · Goal-Oriented Guide**

> This guide provides step-by-step troubleshooting for Kitchen Display System (KDS) issues, including connection problems, display errors, and printer failures.

---

## Overview

The KDS is mission-critical for kitchen operations. This guide covers:

- KDS connection and display issues
- Order synchronization problems
- Station routing failures
- Printer integration problems

---

## Problem: KDS Screen Not Loading

### Diagnosis Steps

#### Step 1: Check Network Connectivity

```bash
# On KDS tablet/device
ping lole.app
ping supabase.co

# Check HTTPS connectivity
curl -I https://lole.app/kds
```

All endpoints should return `200 OK`.

#### Step 2: Check Browser Console

1. Open Chrome DevTools (F12)
2. Check Console tab for errors:
    - WebSocket connection errors
    - Authentication errors
    - CORS errors

#### Step 3: Check Supabase Realtime Status

```bash
curl https://lole.app/api/health/realtime
```

Expected response: `{"status": "ok", "connections": N}`

### Resolution

#### Quick Fix: Refresh Page

1. Press F5 or pull down to refresh
2. Clear browser cache if problem persists
3. Hard refresh: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)

#### Network Issues

1. **Switch networks:**
    - Connect to mobile hotspot if WiFi unstable
    - Restart WiFi router if all devices affected

2. **Check firewall:**
    ```bash
    # Port check
    telnet lole.app 443
    telnet supabase.co 443
    ```

#### Authentication Issues

1. Log out and log back in:
    - Click user avatar → Sign Out
    - Sign in with restaurant credentials

2. Clear browser storage:
    - DevTools → Application → Clear Storage
    - Refresh page

---

## Problem: Orders Not Appearing on KDS

### Diagnosis Steps

#### Step 1: Check Order Status

```sql
-- Verify order exists and is active
SELECT
  id, order_number, status, created_at,
  table_id, type
FROM orders
WHERE restaurant_id = '<restaurant_id>'
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;
```

Orders must have status `pending`, `confirmed`, or `preparing`.

#### Step 2: Check Order Items

```sql
-- Check items and their KDS stations
SELECT
  oi.id,
  mi.name,
  c.kds_station,
  oi.status as item_status,
  oi.kds_station as item_station_override
FROM order_items oi
JOIN menu_items mi ON mi.id = oi.menu_item_id
JOIN categories c ON c.id = mi.category_id
WHERE oi.order_id = '<order_id>';
```

#### Step 3: Check KDS Station Filter

```sql
-- Verify station exists and is configured
SELECT DISTINCT kds_station
FROM order_items
WHERE restaurant_id = '<restaurant_id>'
AND kds_station IS NOT NULL;
```

### Resolution

#### Fix Missing KDS Station

```sql
-- Add missing station from category
UPDATE order_items oi
SET kds_station = c.kds_station
FROM menu_items mi
JOIN categories c ON c.id = mi.category_id
WHERE oi.order_id = '<order_id>'
AND oi.kds_station IS NULL;

-- Set station for entire order
UPDATE orders o
SET kds_station = (
  SELECT DISTINCT c.kds_station
  FROM order_items oi
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  JOIN categories c ON c.id = mi.category_id
  WHERE oi.order_id = o.id
  AND c.kds_station IS NOT NULL
  LIMIT 1
)
WHERE o.id = '<order_id>'
AND o.kds_station IS NULL;
```

#### Force Order Pull

1. Click **Sync** button on KDS
2. This fetches orders directly from database

---

## Problem: KDS Items Stuck in Wrong Status

### Diagnosis

```sql
-- Check item status distribution
SELECT
  status,
  COUNT(*) as count
FROM order_items
WHERE order_id = '<order_id>'
GROUP BY status;
```

### Resolution

#### Manual Status Update

```sql
BEGIN;
-- Update item status
UPDATE order_items
SET status = '<new_status>',  -- pending/started/held/ready/served
    updated_at = NOW()
WHERE id = '<order_item_id>';

-- Log the change
INSERT INTO kds_action_log (
  order_item_id, action, timestamp, staff_id
) VALUES (
  '<order_item_id>', '<new_status>', NOW(), '<staff_id>'
);
COMMIT;
```

#### Bulk Status Update

```sql
-- Start all pending items
UPDATE order_items
SET status = 'started',
    updated_at = NOW()
WHERE order_id = '<order_id>'
AND status = 'pending';

-- Mark items as ready
UPDATE order_items
SET status = 'ready',
    updated_at = NOW()
WHERE order_id = '<order_id>'
AND status = 'started';
```

---

## Problem: KDS Realtime Connection Drops

### Diagnosis

```javascript
// In browser console on KDS
supabase.getChannel('kds-orders').state; // Should be 'joined'
supabase.realtime.isConnected(); // Should be true

// Check connection stats
supabase.realtime.connectionStats();
```

### Resolution

#### Immediate Fix

1. Refresh KDS page
2. If persists, restart tablet:

    ```bash
    # On Android device
    adb reboot

    # Or through settings
    Settings → System → Reboot
    ```

#### Check Supabase Connection Limits

```sql
-- Check connection count (admin query)
SELECT COUNT(*) as active_connections
FROM pg_stat_activity
WHERE application_name LIKE '%realtime%';
```

If near limit (100 per database), contact Supabase support.

---

## Problem: KDS Station Filter Not Working

### Diagnosis

#### Step 1: Check Station Configuration

```sql
-- List all configured stations
SELECT DISTINCT kds_station
FROM order_items
WHERE restaurant_id = '<restaurant_id>'
ORDER BY kds_station;
```

#### Step 2: Check KDS User Station

```sql
-- Verify logged-in user station
SELECT
  rs.role,
  rs.station as assigned_station
FROM restaurant_staff rs
WHERE rs.user_id = '<user_id>'
AND rs.is_active = true;
```

### Resolution

#### Update Category Station

```sql
-- Set KDS station on category
UPDATE categories
SET kds_station = '<station_name>'
WHERE id = '<category_id>';

-- Backfill existing orders
UPDATE order_items oi
SET kds_station = '<station_name>'
FROM menu_items mi
JOIN categories c ON c.id = mi.category_id
WHERE oi.menu_item_id = mi.id
AND c.id = '<category_id>'
AND oi.kds_station IS NULL;
```

---

## Quick Reference Commands

```bash
# KDS health check script
echo "=== KDS Health Check ==="
ping -c 3 lole.app && echo "Network: OK"
curl -s https://lole.app/api/health | jq -r '.status' && echo "API: OK"
```

---

## Related Documentation

- [Order Troubleshooting Guide](./order-troubleshooting.md)
- [KDS Printer Failures Runbook](../operations/runbooks/kds-printer-failures.md)
- [Payment Troubleshooting Guide](./payment-troubleshooting.md)
