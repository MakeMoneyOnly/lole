# Deployment Rollback Runbook

**Last Updated:** 2026-05-20
**Scope:** Vercel deployments for Lole Restaurant OS
**SLA Impact:** 2-5 minutes to execute

---

## When to Initiate Rollback

Initiate rollback immediately when any of the following conditions are met:

### Critical Triggers

| Trigger                                        | Severity | Action             |
| ---------------------------------------------- | -------- | ------------------ |
| Sentry error rate > 5% over 5 minutes          | Sev1     | Immediate rollback |
| `/api/health` returns non-200 for > 2 minutes  | Sev1     | Immediate rollback |
| Payment processing failures > 10% transactions | Sev1     | Immediate rollback |
| KDS stops receiving orders                     | Sev1     | Immediate rollback |
| Database connection errors > 100/min           | Sev2     | Consider rollback  |
| P95 latency > 2x SLO baseline                  | Sev2     | Consider rollback  |

### Manual Detection

- Merchant/staff reports of critical functionality failure
- Monitoring dashboard shows anomalous patterns
- Suspicious activity detected in logs

---

## Rollback Triggers from Monitoring

### Sentry Alerts

```
Alert: Error rate spike detected
Condition: >5% error rate over 5-minute window
Action: Verify in Sentry dashboard, then initiate rollback if confirmed
```

### Vercel Monitoring

```
Alert: Deployment health check failed
Condition: GET /api/health returns non-200
Action: Check Vercel dashboard for deployment errors
```

### Custom Health Check

```bash
# Run from any terminal
curl -f https://lole.app/api/health || echo "HEALTH CHECK FAILED"
```

---

## Step-by-Step Rollback Procedure

### Option 1: Vercel Dashboard (GUI)

**Time to execute: 2-3 minutes**

1. **Navigate to Vercel Dashboard**
    - Go to https://vercel.com/dashboard
    - Select `lole` project
    - Click `Deployments` tab

2. **Identify Previous Stable Deployment**
    - Look for deployment before the current version
    - Verify health: Green status badge, no error logs
    - Note the deployment ID (format: `dpl_xxxxx`)

3. **Initiate Rollback**
    - Click the `...` menu on target deployment
    - Select `Rollback to this deployment`
    - Confirm rollback action

4. **Verify Rollback**
    - Wait for new active deployment to show
    - Check deployment logs for successful completion
    - Confirm `Active` status on rolled-back deployment

### Option 2: Vercel CLI

**Time to execute: 1-2 minutes**

```bash
# Prerequisites: Vercel CLI installed, authenticated
npm install -g vercel

# List recent deployments
vercel deployments list --token=$VERCEL_TOKEN

# Rollback to previous deployment
vercel rollback --token=$VERCEL_TOKEN

# Or rollback to specific deployment
vercel rollback dpl_xxxxxxxxxxxx --token=$VERCEL_TOKEN
```

### Option 3: GitHub Actions Workflow

**Time to execute: 3-5 minutes**

1. Navigate to GitHub repository → Actions → `Rollback`
2. Click `Run workflow`
3. Configure:
    - `environment`: `production`
    - `rollback_type`: `previous`
    - `reason`: Brief description of issue
4. Execute workflow

```bash
# API invocation
gh api -X POST /repos/lole/restaurant-os/actions/workflows/rollback.yml/dispatches \
  -f ref=main \
  -f inputs='{"environment":"production","rollback_type":"previous","reason":"Critical error"}'
```

### Option 4: Emergency Feature Flag (Fastest)

**Time to execute: < 1 minute**

```bash
# Set emergency kill switch in Vercel environment variables
PILOT_BLOCK_MUTATIONS=true
```

Then trigger redeploy. This puts platform in read-only mode while investigating.

---

## Verification Steps Post-Rollback

Execute verification checklist within 5 minutes of rollback completion:

### Automated Verification

```bash
# 1. Health check
curl -f https://lole.app/api/health
echo $? # Should return 0

# 2. Payment test (use test card)
curl -X POST https://lole.app/api/payments/test

# 3. Order flow test
curl -X GET https://lole.app/api/orders?test=true
```

### Manual Verification Checklist

- [ ] **Application serving traffic** — Verify Vercel deployment shows `Active` status with no errors
- [ ] **Health endpoint responding** — `GET /api/health` returns 200 within 500ms
- [ ] **Database queries succeeding** — Run representative query against orders table
- [ ] **Real-time subscriptions active** — Verify KDS shows connection status
- [ ] **Payment processing functional** — Test Telebirr/Chapa on founder's restaurant
- [ ] **KDS receiving orders** — Create test order, verify P95 <= 2s arrival
- [ ] **Error rates normal** — Check Sentry, confirm <1% error rate
- [ ] **Latency within SLO** — Verify P0 endpoints meet targets:
    - `GET /api/merchant/command-center` P95 <= 500ms
    - `GET /api/orders` P95 <= 400ms
    - `PATCH /api/orders/:id/status` P95 <= 300ms

### Verification Commands

```bash
# Check Vercel deployment status
vercel deployments ls --limit 1 --token=$VERCEL_TOKEN

# Check recent errors in Sentry
curl https://sentry.io/api/0/projects/lole/restaurant-os/events/?query=level:unhandled

# Verify database connectivity
supabase db remote commit --project-ref $SUPABASE_PROJECT_ID
```

---

## Communication Protocol

### Internal Communication (Telegram)

**Initial Alert:**

```
🚨 ROLLBACK INITIATED
Reason: [Brief description]
Type: Deploy
Environment: Production
ETA: 5 minutes
IC: @[oncall-engineer]
```

**Completion Notification:**

```
✅ ROLLBACK COMPLETE
Duration: [X minutes]
Verification: [All checks passed / Issues noted]
Current State: Production on [deployment-id]
Next Steps: [Root cause investigation / Hotfix plan]
IC: @[engineer]
```

### Merchant Communication

**English (via status page):**

```
We are experiencing technical difficulties and have performed a rollback to restore service. All systems are now operational. We apologize for any inconvenience.
```

**Amharic (via status page):**

```
የቴክኖሌጂ ችግኝ እየተገኙን ነው እና አገልግሎትን ለማድረግ የመጠረጃ ደረጃ ላይ እንደሆነ የተለያዩ ወኪሎችን ጨምርተው ነው። ምንም ያስተዳድሩ አይደለም ግን አሁን ምንም የሰሩ አሁን ይደርሳል።
```

የ� technologie ችግኝ እየተገኙን ነው እና አገልግሎትን ለማድረግ የመጠረግ ደረጃ ላይ እንደሆነ የተለያዩ ወኪሎችን ጨምርተው ነው። ምንም ያስተዳድሩ አይደለም ግን አሁን ምንም የሰሩ አሁን ይደርሳል።

```

### Escalation Path

1. **Primary:** On-call engineer (Telegram: @oncall)
2. **Secondary:** Engineering Lead (Telegram: @[handle])
3. **Tertiary:** CTO (Telegram: @[handle])

---

## Rollback Runbook Summary

| Step | Action                      | Time       |
| ---- | --------------------------- | ---------- |
| 1    | Detect issue via monitoring | Immediate  |
| 2    | Classify severity           | < 1 min    |
| 3    | Assign incident commander   | < 1 min    |
| 4    | Execute rollback            | 2-5 min    |
| 5    | Verify system health        | 5 min      |
| 6    | Communicate completion      | < 1 min    |
| 7    | Document incident           | Within 24h |

---

## Related Documentation

- [Incident Response Plan](../../docs/how-to/operational-runbooks/incident-response-plan.md)
- [Rollback Procedures Enhanced](../../docs/reference/reports/rollout/rollback-procedures-enhanced.md)
- [Error Monitoring Setup](./error-monitoring-setup.md)
- [Cron Monitoring Runbook](./cron-monitoring-runbook.md)
```
