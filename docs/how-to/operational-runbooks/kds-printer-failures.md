# KDS Printer Failures Runbook

**Version 1.0 · March 2026 · For the Builder**

> This runbook covers the diagnosis and resolution of Kitchen Display System (KDS) and printer failures in lole restaurants.

---

## Overview

The KDS is critical for kitchen operations. When KDS or printers fail, orders cannot be communicated to the kitchen, causing service delays. This runbook ensures rapid recovery and fallback procedures.

---

## System Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   POS/      │────▶│   Supabase  │────▶│    KDS      │
│   Guest     │     │   Realtime  │     │   Display   │
│   Orders    │     │             │     │             │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                         ┌─────────────┐
                                         │   Thermal   │
                                         │ (Capacitor) │
                                         └─────────────┘
```

---

## Failure Classification

| Failure Type         | Severity | Impact                    | Recovery Time Target |
| -------------------- | -------- | ------------------------- | -------------------- |
| KDS Display Down     | Sev2     | Kitchen cannot see orders | 5 minutes            |
| Printer Offline      | Sev3     | No printed tickets        | 10 minutes           |
| Realtime Sync Down   | Sev2     | Orders not updating       | 5 minutes            |
| Complete KDS Failure | Sev1     | No kitchen communication  | Immediate fallback   |

---

## KDS Display Issues

### Symptom: KDS Screen Not Loading

**Diagnosis:**

1. **Check network connectivity:**

    ```bash
    # On KDS tablet
    ping lole.app
    ping supabase.co
    ```

2. **Check browser console:**
    - Open Chrome DevTools (F12)
    - Check for WebSocket errors
    - Look for authentication errors

3. **Check Supabase Realtime status:**
    ```bash
    curl https://lole.app/api/health/realtime
    ```

**Resolution:**

1. **Quick fix - Refresh page:**
    - Press F5 or pull down to refresh
    - Clear browser cache if persistent

2. **Network issues:**
    - Switch to mobile data if WiFi is unstable
    - Restart router if all devices affected

3. **Authentication issues:**
    - Log out and log back in
    - Clear browser storage and re-authenticate

### Symptom: Orders Not Appearing on KDS

**Diagnosis:**

1. **Check order status in database:**

    ```sql
    SELECT id, order_number, status, created_at
    FROM orders
    WHERE restaurant_id = '<restaurant_id>'
    AND status IN ('pending', 'confirmed', 'preparing')
    ORDER BY created_at DESC
    LIMIT 10;
    ```

2. **Check realtime subscription:**

    ```javascript
    // In browser console on KDS page
    window.__KDS_DEBUG__.channel.state; // Should be 'joined'
    ```

3. **Check order items:**
    ```sql
    SELECT oi.id, oi.status, oi.station
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.restaurant_id = '<restaurant_id>'
    AND oi.status IN ('pending', 'preparing')
    ORDER BY oi.created_at DESC;
    ```

**Resolution:**

1. **Reconnect realtime:**
    - The KDS should auto-reconnect
    - If not, refresh the page

2. **Manual order pull:**
    - Click "Sync" button on KDS
    - This fetches orders directly from database

---

## Printer Issues

### Symptom: Printer Not Responding

**Diagnosis:**

1. **Check device shell status:**
    - Open Chrome `chrome://inspect/#devices` on a laptop connected to the tablet.
    - Check the `Console` for `@capacitor/printer` plugin errors.

2. **Check Capacitor native logs:**
    - Look for `ThermalPrinter` or `PrinterBridge` events in the device logs.

    # Should return process ID

    ```

    ```

3. **Check printer connection:**

    ```bash
    # List connected USB devices
    lsusb | grep -i printer

    # Check printer device
    ls -la /dev/usb/lp*
    ```

**Resolution:**

1. **Restart the lole Device Shell app:**
    - Swipe the app away to close it.
    - Re-open the 'lole' app from the home screen.
    - This re-initializes the Capacitor plugins.

2. **Reconnect printer:**
    - Unplug and replug USB cable
    - Check printer has paper
    - Check printer power

3. **Test print:**
    ```bash
    # Send test print
    echo "Test Print - $(date)" | lp
    ```

### Symptom: Partial Prints / Garbled Output

**Diagnosis:**

1. **Check paper and ribbon:**
    - Ensure thermal paper is correctly loaded
    - Check paper roll is not empty

2. **Check print settings:**
    ```bash
    # Verify paper size setting
    cat ~/lole-print/config.json
    ```

**Resolution:**

1. **Clean printer head:**
    - Use alcohol wipe on thermal head
    - Remove any debris

2. **Adjust print settings:**
    ```json
    {
        "paperWidth": 80, // mm - typically 80mm for kitchen printers
        "charsPerLine": 48,
        "encoding": "UTF-8"
    }
    ```

---

## Complete KDS Failure Fallback

When KDS is completely unavailable, use manual fallback:

### Paper Ticket Mode

1. **POS devices can print directly:**
    - Orders placed on POS print to backup printer
    - Enable "Direct Print" mode in restaurant settings

2. **Verbal communication:**
    - Server communicates order directly to kitchen
    - Use order number from POS screen

### Offline Mode

The KDS continues to work offline with cached data:

1. **Orders sync when connection restores:**
    - PowerSync stores orders locally
    - Automatic sync on reconnection

2. **Manual sync verification:**
    ```sql
    -- After recovery, verify all orders synced
    SELECT COUNT(*) as unsynced
    FROM orders
    WHERE restaurant_id = '<restaurant_id>'
    AND created_at > NOW() - INTERVAL '2 hours'
    AND id NOT IN (
      SELECT order_id FROM kds_order_items
    );
    ```

---

## Monitoring and Alerts

### KDS Health Check

```bash
# Automated health check script
curl -f https://lole.app/api/health/kds || \
  curl -X POST $ALERT_WEBHOOK_URL \
    -d '{"text": "KDS health check failed"}'
```

### Realtime Connection Monitoring

```javascript
// Monitor realtime connection in KDS
useEffect(() => {
    const channel = supabase.channel('kds-monitor');

    channel.on('system', { event: 'disconnected' }, () => {
        sendAlert('KDS realtime disconnected');
    });

    return () => channel.unsubscribe();
}, []);
```

---

## Troubleshooting Commands

### Check All Services

```bash
# Full system check
echo "=== Network ==="
ping -c 3 lole.app

echo "=== Supabase ==="
curl -s https://lole.app/api/health | jq

echo "=== Printer ==="
curl -s http://localhost:3000/printer/status

echo "=== Termux ==="
pgrep -a print-server
```

### Restart All Services

```bash
# On KDS tablet/device

# 1. Restart browser
am force-stop com.android.chrome
am start -a android.intent.action.VIEW -d https://lole.app/kds

# 2. Restart Termux print server
pkill -f print-server
cd ~/lole-print && ./start-print-server.sh &

# 3. Verify services
sleep 5
curl -s http://localhost:3000/printer/status
```

---

## Prevention Measures

### Daily Checks

- [ ] Printer paper supply
- [ ] KDS display clean and visible
- [ ] Network connectivity stable
- [ ] Backup printer available

### Weekly Maintenance

- [ ] Clean printer thermal head
- [ ] Check printer ribbon (if applicable)
- [ ] Test backup printing procedure
- [ ] Verify offline mode works

### Monthly Review

- [ ] Analyze printer failure logs
- [ ] Review KDS uptime metrics
- [ ] Update printer firmware if available
- [ ] Train new staff on fallback procedures

---

## Incident Record Template

```markdown
## KDS/Printer Incident

**Date:** YYYY-MM-DD
**Duration:** X minutes
**Restaurant:** [Name]
**Failure Type:** [Display/Printer/Realtime/Complete]

### Timeline

- HH:MM - Issue detected by [staff/alert]
- HH:MM - Diagnosis completed
- HH:MM - Resolution applied
- HH:MM - Normal operations resumed

### Root Cause

[Technical explanation]

### Orders Affected

- Number of delayed orders: X
- Average delay: X minutes

### Resolution

[Steps taken to fix]

### Follow-ups

- [ ] [Action item] - Owner - Due date
```

---

## Contacts and Escalation

| Role               | Contact          | Escalation Time |
| ------------------ | ---------------- | --------------- |
| Restaurant Manager | On-site          | Immediate       |
| Technical Support  | @tech-support    | 5 minutes       |
| On-call Engineer   | PagerDuty        | 10 minutes      |
| Hardware Vendor    | [Vendor contact] | As needed       |

---

## Related Documents

- [Disaster Recovery Plan](../05-infrastructure/disaster-recovery.md)
- [Incident Triage Rubric](./incident-triage-rubric.md)
- [KDS Printer Webhook Contract](../10-reference/kds-printer-webhook-contract.md)
