# Cron Job Monitoring Runbook

## Overview

This runbook covers the stale device check cron job at `/api/jobs/cron/stale-device-check`.

## Cron Job Details

| Property | Value                                            |
| -------- | ------------------------------------------------ |
| Endpoint | `/api/jobs/cron/stale-device-check`              |
| Schedule | Daily at midnight UTC                            |
| Purpose  | Identify and process stale devices in the system |

## Monitoring Strategy

### Vercel Built-in Logging

Monitor cron execution via Vercel's built-in logging:

1. Navigate to Vercel Dashboard → Project → Logs
2. Filter by:
    - Source: Edge Functions
    - Status: All (or filter errors)
    - Time range: Last 24 hours

### Key Metrics to Track

- Execution duration (target: <30s)
- Success/failure rate
- Memory usage peaks
- Cold start frequency

## Alerting Recommendations

### Critical Alerts

| Condition            | Threshold | Action           |
| -------------------- | --------- | ---------------- |
| Cron job failure     | 1 failure | Page on-call     |
| Duration exceeded    | >60s      | Warning alert    |
| Consecutive failures | 2         | Escalation alert |

### Setup Instructions

1. In Vercel Dashboard, go to Settings → Alerts
2. Create alert for:
    - Function: `stale-device-check`
    - Metric: Error rate > 0%
    - Threshold: 1 occurrence
    - Notification: Slack/webhook to operations channel

## Troubleshooting Steps

### Step 1: Verify Cron Trigger

```bash
curl -X GET "https://your-domain.com/api/jobs/cron/stale-device-check" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Step 2: Check Logs

Review Vercel logs for:

- Database connection errors
- Timeout exceptions
- Rate limiting issues

### Step 3: Validate Dependencies

- Database connectivity (check connection pool)
- External API services (if any)
- Environment variables

### Step 4: Manual Execution

If automated execution fails, run manually:

```bash
# Using Vercel CLI
vercel fn invoke stale-device-check
```

### Common Issues

| Issue                  | Solution                                         |
| ---------------------- | ------------------------------------------------ |
| Database timeout       | Increase connection timeout, check query indexes |
| Memory limit exceeded  | Optimize batch processing, reduce payload size   |
| Authentication failure | Verify `CRON_SECRET` environment variable        |

## Runbook Maintenance

- Review this runbook quarterly
- Update contact information for on-call rotations
- Adjust thresholds based on observed performance
