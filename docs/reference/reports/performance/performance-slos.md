# Performance Service Level Objectives (SLOs)

Last updated: 2026-04-04

## Overview

This document defines the Service Level Objectives (SLOs) for the lole Restaurant OS platform. SLOs are measurable targets that define the expected level of service for critical system components.

### SLO Framework

| Term                              | Definition                                             |
| --------------------------------- | ------------------------------------------------------ |
| **SLI** (Service Level Indicator) | A quantitative measure of service behavior             |
| **SLO** (Service Level Objective) | Target value for an SLI                                |
| **Error Budget**                  | Allowable amount of unreliability within a time window |

---

## User-Facing API SLO Targets

### Command Center API

| Metric       | SLO Target | Measurement Window |
| ------------ | ---------- | ------------------ |
| P95 Latency  | ≤ 500ms    | Rolling 5 minutes  |
| Error Rate   | < 1%       | Rolling 5 minutes  |
| Availability | ≥ 99.5%    | Monthly            |

**Endpoint**: `GET /api/merchant/command-center`

### Orders List API

| Metric       | SLO Target | Measurement Window |
| ------------ | ---------- | ------------------ |
| P95 Latency  | ≤ 400ms    | Rolling 5 minutes  |
| Error Rate   | < 1%       | Rolling 5 minutes  |
| Availability | ≥ 99.5%    | Monthly            |

**Endpoint**: `GET /api/orders`

### Order Status Update API

| Metric       | SLO Target | Measurement Window |
| ------------ | ---------- | ------------------ |
| P95 Latency  | ≤ 300ms    | Rolling 5 minutes  |
| Error Rate   | < 0.5%     | Rolling 5 minutes  |
| Availability | ≥ 99.9%    | Monthly            |

**Endpoint**: `PATCH /api/orders/:id/status`

### Peak Hour Ordering

| Metric      | SLO Target       | Measurement Window |
| ----------- | ---------------- | ------------------ |
| P95 Latency | ≤ 500ms          | Rolling 5 minutes  |
| Error Rate  | < 1%             | Rolling 5 minutes  |
| Throughput  | ≥ 100 orders/min | Peak hours         |

**Endpoint**: `POST /api/orders`

---

## KDS Performance SLOs

### KDS Queue Retrieval

| Metric      | SLO Target | Measurement Window |
| ----------- | ---------- | ------------------ |
| P95 Latency | ≤ 300ms    | Rolling 5 minutes  |
| Error Rate  | < 1%       | Rolling 5 minutes  |
| Queue Depth | < 20 items | Real-time          |

**Endpoint**: `GET /api/kds/queue`

### KDS Status Updates

| Metric          | SLO Target       | Measurement Window |
| --------------- | ---------------- | ------------------ |
| P95 Latency     | ≤ 200ms          | Rolling 5 minutes  |
| Error Rate      | < 1%             | Rolling 5 minutes  |
| Processing Rate | ≥ 50 updates/min | Peak hours         |

**Endpoint**: `PATCH /api/kds/items/:id/status`

---

## Payment Gateway SLOs

### Payment Processing

| Metric       | SLO Target | Measurement Window |
| ------------ | ---------- | ------------------ |
| P95 Latency  | ≤ 2000ms   | Rolling 5 minutes  |
| Success Rate | ≥ 95%      | Rolling 5 minutes  |
| Error Rate   | < 2%       | Rolling 5 minutes  |
| Availability | ≥ 99.9%    | Monthly            |

**Endpoint**: `POST /api/payments`

### Payment Webhooks

| Metric          | SLO Target        | Measurement Window |
| --------------- | ----------------- | ------------------ |
| P95 Latency     | ≤ 500ms           | Rolling 5 minutes  |
| Error Rate      | < 1%              | Rolling 5 minutes  |
| Processing Rate | ≥ 50 webhooks/min | Peak hours         |

**Endpoint**: `POST /api/payments/webhook`

---

## Table Session SLOs

### Session Management

| Metric              | SLO Target | Measurement Window |
| ------------------- | ---------- | ------------------ |
| P95 Latency         | ≤ 400ms    | Rolling 5 minutes  |
| Error Rate          | < 1%       | Rolling 5 minutes  |
| Concurrent Sessions | ≥ 100      | Peak hours         |

**Endpoint**: `POST /api/sessions`

### Session Heartbeat

| Metric         | SLO Target | Measurement Window |
| -------------- | ---------- | ------------------ |
| P95 Latency    | ≤ 200ms    | Rolling 5 minutes  |
| Error Rate     | < 1%       | Rolling 5 minutes  |
| Heartbeat Rate | ≥ 100/min  | Peak hours         |

**Endpoint**: `POST /api/sessions/:id/heartbeat`

---

## Realtime Freshness SLOs

| Metric                          | SLO Target | Measurement Window |
| ------------------------------- | ---------- | ------------------ |
| Order state propagation         | P95 ≤ 2s   | Rolling 5 minutes  |
| Table/session state propagation | P95 ≤ 2s   | Rolling 5 minutes  |
| KDS update propagation          | P95 ≤ 1s   | Rolling 5 minutes  |
| Event lag alert threshold       | > 5s       | Immediate          |

---

## Frontend Performance SLOs

### Core Web Vitals

| Metric                          | SLO Target | Measurement     |
| ------------------------------- | ---------- | --------------- |
| Largest Contentful Paint (LCP)  | ≤ 2.5s     | 75th percentile |
| Interaction to Next Paint (INP) | ≤ 200ms    | 75th percentile |
| Cumulative Layout Shift (CLS)   | ≤ 0.1      | 75th percentile |

### Dashboard Performance

| Metric                   | SLO Target | Measurement        |
| ------------------------ | ---------- | ------------------ |
| Primary dashboard render | ≤ 2.5s     | Standard broadband |
| Filter/search response   | ≤ 300ms    | UI feedback        |
| Time to Interactive      | ≤ 3.5s     | Standard broadband |

---

## Database Performance SLOs

| Metric                      | SLO Target | Measurement Window |
| --------------------------- | ---------- | ------------------ |
| Query P95 Latency           | ≤ 300ms    | Rolling 5 minutes  |
| Connection Pool Utilization | < 80%      | Real-time          |
| Deadlock Rate               | < 0.1%     | Daily              |
| Slow Query Rate             | < 1%       | Daily              |

---

## SLO Validation Checklist

### API Response Time Validation

- [ ] **Command Center API** (`GET /api/merchant/command-center`)
    - [ ] P95 latency measured via k6 load test
    - [ ] P95 latency measured via Grafana dashboard
    - [ ] Error rate calculated from Sentry events
    - [ ] Availability calculated from uptime checks

- [ ] **Orders List API** (`GET /api/orders`)
    - [ ] P95 latency measured via k6 load test
    - [ ] P95 latency measured via Grafana dashboard
    - [ ] Error rate calculated from Sentry events
    - [ ] Availability calculated from uptime checks

- [ ] **Order Status Update API** (`PATCH /api/orders/:id/status`)
    - [ ] P95 latency measured via k6 load test
    - [ ] P95 latency measured via Grafana dashboard
    - [ ] Error rate calculated from Sentry events
    - [ ] Idempotency verified

- [ ] **Peak Hour Ordering** (`POST /api/orders`)
    - [ ] P95 latency measured under load
    - [ ] Throughput validated at 100+ orders/min
    - [ ] Error rate under 1% during peak simulation

### KDS Performance Validation

- [ ] **KDS Queue**
    - [ ] P95 latency measured via k6
    - [ ] Queue depth monitored in Grafana
    - [ ] Processing rate validated

- [ ] **KDS Status Updates**
    - [ ] P95 latency measured via k6
    - [ ] Update rate validated at 50+ updates/min

### Payment Gateway Validation

- [ ] **Payment Processing**
    - [ ] P95 latency measured via k6
    - [ ] Success rate validated at > 95%
    - [ ] Provider-specific latency measured (Telebirr, Chapa)

- [ ] **Payment Webhooks**
    - [ ] P95 latency measured
    - [ ] Processing rate validated

### Realtime Propagation Validation

- [ ] **Order State Propagation**
    - [ ] P95 latency measured via custom metrics
    - [ ] Channel subscription latency validated
    - [ ] Event lag alerts configured

- [ ] **Table/Session State Propagation**
    - [ ] P95 latency measured via custom metrics
    - [ ] Heartbeat processing validated

### Frontend Performance Validation

- [ ] **Core Web Vitals**
    - [ ] LCP measured via Lighthouse CI
    - [ ] INP measured via CrUX data
    - [ ] CLS measured via Lighthouse CI

- [ ] **Dashboard Performance**
    - [ ] Time to Interactive measured
    - [ ] Filter/search response measured

---

## Measurement Procedures

### Tools and Data Sources

| Tool                 | Purpose                            | Data Source                 |
| -------------------- | ---------------------------------- | --------------------------- |
| **k6**               | Load testing, synthetic metrics    | `k6/peak-flow-scenarios.js` |
| **Grafana**          | Real-time monitoring dashboards    | Prometheus metrics          |
| **Sentry**           | Error tracking, performance traces | Application telemetry       |
| **Lighthouse CI**    | Frontend performance               | CI pipeline                 |
| **Vercel Analytics** | Real User Monitoring (RUM)         | Production traffic          |

### Measurement Cadence

| Metric Type       | Collection Frequency | Reporting Frequency |
| ----------------- | -------------------- | ------------------- |
| API latency       | Continuous           | Hourly summary      |
| Error rates       | Continuous           | Hourly summary      |
| Realtime latency  | Continuous           | Hourly summary      |
| Core Web Vitals   | Per deployment       | Weekly summary      |
| Load test results | Daily (staging)      | Weekly report       |
| Full SLO report   | Monthly              | Monthly review      |

### Measurement Commands

#### k6 Load Testing

```bash
# Run full SLO validation suite
k6 run k6/peak-flow-scenarios.js

# Run specific endpoint validation
k6 run k6/peak-flow-scenarios.js --include-scenarios command_center,orders_list

# Run peak hour simulation
k6 run k6/peak-flow-scenarios.js --include-scenarios peak_hour_lunch,peak_hour_dinner
```

#### Grafana Dashboard Queries

```promql
# API P95 latency (last 5 minutes)
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket{job="lole-api"}[5m])) by (le)
) * 1000

# Error rate (last 5 minutes)
sum(rate(http_requests_total{job="lole-api",status=~"5.."}[5m]))
  / sum(rate(http_requests_total{job="lole-api"}[5m]))

# Realtime propagation P95
histogram_quantile(0.95,
  sum(rate(lole_realtime_propagation_seconds_bucket[5m])) by (le)
) * 1000

# KDS queue depth
lole_kds_queue_depth

# Payment success rate
sum(rate(lole_payment_requests_total{status="completed"}[5m]))
  / sum(rate(lole_payment_requests_total[5m]))
```

#### Sentry API Queries

```bash
# Get error count for last hour
curl -H "Authorization: Bearer $SENTRY_TOKEN" \
  "https://sentry.io/api/0/projects/lole/lole-api/stats/?stat=errors&resolution=1h"

# Get transaction duration P95
curl -H "Authorization: Bearer $SENTRY_TOKEN" \
  "https://sentry.io/api/0/projects/lole/lole-api/transactions/?stat=duration_p95"
```

#### Lighthouse CI

```bash
# Run Lighthouse audit
lhci autorun --upload.target=temporary-public-storage

# Collect Core Web Vitals
lhci collect --url=https://lole.app/merchant/dashboard
```

---

## SLO Compliance Report Template

### Monthly SLO Compliance Report

**Report Period**: [Month Year]
**Generated**: [Date]
**Prepared By**: [Team/Person]

#### Executive Summary

| SLO Category     | Target  | Actual     | Status |
| ---------------- | ------- | ---------- | ------ |
| API Availability | 99.5%   | [Actual]%  | ✅/❌  |
| API P95 Latency  | ≤ 500ms | [Actual]ms | ✅/❌  |
| Error Rate       | < 1%    | [Actual]%  | ✅/❌  |
| Realtime Latency | ≤ 2s    | [Actual]s  | ✅/❌  |
| Payment Success  | ≥ 95%   | [Actual]%  | ✅/❌  |

#### API Performance Details

| Endpoint                       | P50 Latency | P95 Latency | P99 Latency | Error Rate | Status |
| ------------------------------ | ----------- | ----------- | ----------- | ---------- | ------ |
| `/api/merchant/command-center` | [value]ms   | [value]ms   | [value]ms   | [value]%   | ✅/❌  |
| `/api/orders`                  | [value]ms   | [value]ms   | [value]ms   | [value]%   | ✅/❌  |
| `/api/orders/:id/status`       | [value]ms   | [value]ms   | [value]ms   | [value]%   | ✅/❌  |
| `/api/payments`                | [value]ms   | [value]ms   | [value]ms   | [value]%   | ✅/❌  |

#### KDS Performance

| Metric            | Target   | Actual      | Status |
| ----------------- | -------- | ----------- | ------ |
| Queue P95 Latency | ≤ 300ms  | [value]ms   | ✅/❌  |
| Queue Depth (max) | < 20     | [value]     | ✅/❌  |
| Processing Rate   | ≥ 50/min | [value]/min | ✅/❌  |

#### Payment Gateway Performance

| Provider | P95 Latency | Success Rate | Error Rate | Status |
| -------- | ----------- | ------------ | ---------- | ------ |
| Telebirr | [value]ms   | [value]%     | [value]%   | ✅/❌  |
| Chapa    | [value]ms   | [value]%     | [value]%   | ✅/❌  |
| Overall  | [value]ms   | [value]%     | [value]%   | ✅/❌  |

#### Realtime Performance

| Channel  | P95 Latency | P99 Latency | Event Lag | Status |
| -------- | ----------- | ----------- | --------- | ------ |
| Orders   | [value]ms   | [value]ms   | [value]ms | ✅/❌  |
| Sessions | [value]ms   | [value]ms   | [value]ms | ✅/❌  |
| KDS      | [value]ms   | [value]ms   | [value]ms | ✅/❌  |

#### Frontend Performance (Core Web Vitals)

| Metric | Target  | Desktop   | Mobile    | Status |
| ------ | ------- | --------- | --------- | ------ |
| LCP    | ≤ 2.5s  | [value]s  | [value]s  | ✅/❌  |
| INP    | ≤ 200ms | [value]ms | [value]ms | ✅/❌  |
| CLS    | ≤ 0.1   | [value]   | [value]   | ✅/❌  |

#### Error Budget Status

| Service  | Monthly Budget | Consumed   | Remaining   | Burn Rate |
| -------- | -------------- | ---------- | ----------- | --------- |
| API      | [budget]       | [consumed] | [remaining] | [rate]    |
| Payments | [budget]       | [consumed] | [remaining] | [rate]    |

#### Incidents and SLO Breaches

| Date   | Severity | Description   | Duration   | Resolution   |
| ------ | -------- | ------------- | ---------- | ------------ |
| [date] | [sev]    | [description] | [duration] | [resolution] |

#### Recommendations

1. [Recommendation based on findings]
2. [Recommendation based on findings]
3. [Recommendation based on findings]

---

## Alerting Recommendations

### Alert Severity Levels

| Level        | Response Time     | Example                    |
| ------------ | ----------------- | -------------------------- |
| **Critical** | Immediate (5 min) | SLO breach affecting users |
| **Warning**  | < 30 minutes      | Approaching SLO threshold  |
| **Info**     | < 4 hours         | Non-critical anomaly       |

### Alert Configuration

#### API Latency Alerts

```yaml
# Critical: P95 latency > 2x SLO
- alert: APICriticalLatency
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
  for: 5m
  labels:
      severity: critical
  annotations:
      summary: 'API P95 latency critical'
      description: 'P95 latency is {{ $value }}s, exceeding 2x SLO'

# Warning: P95 latency > SLO
- alert: APIHighLatency
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5
  for: 5m
  labels:
      severity: warning
  annotations:
      summary: 'API P95 latency high'
      description: 'P95 latency is {{ $value }}s, exceeding SLO'
```

#### Error Rate Alerts

```yaml
# Critical: Error rate > 5%
- alert: CriticalErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
  for: 5m
  labels:
      severity: critical

# Warning: Error rate > 1%
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.01
  for: 5m
  labels:
      severity: warning
```

#### Realtime Latency Alerts

```yaml
# Critical: Realtime lag > 5s
- alert: RealtimeCriticalLag
  expr: histogram_quantile(0.95, rate(lole_realtime_propagation_seconds_bucket[5m])) > 5
  for: 1m
  labels:
      severity: critical

# Warning: Realtime lag > 2s
- alert: RealtimeHighLag
  expr: histogram_quantile(0.95, rate(lole_realtime_propagation_seconds_bucket[5m])) > 2
  for: 5m
  labels:
      severity: warning
```

#### Payment Alerts

```yaml
# Critical: Payment success rate < 90%
- alert: PaymentSuccessCritical
  expr: sum(rate(lole_payment_requests_total{status="completed"}[5m])) / sum(rate(lole_payment_requests_total[5m])) < 0.90
  for: 5m
  labels:
      severity: critical

# Warning: Payment success rate < 95%
- alert: PaymentSuccessLow
  expr: sum(rate(lole_payment_requests_total{status="completed"}[5m])) / sum(rate(lole_payment_requests_total[5m])) < 0.95
  for: 5m
  labels:
      severity: warning
```

---

## Error Budget Policy

### Error Budget Calculation

```
Error Budget = (1 - SLO Target) × Time Window

Example for 99.5% availability monthly:
Error Budget = (1 - 0.995) × 30 days × 24 hours × 60 minutes
             = 0.005 × 43,200 minutes
             = 216 minutes of downtime allowed per month
```

### Error Budget Consumption Tracking

| Service  | Monthly Budget | Consumed | Remaining   | Status   |
| -------- | -------------- | -------- | ----------- | -------- |
| API      | 216 min        | [actual] | [remaining] | 🟢/🟡/🔴 |
| Payments | 43 min         | [actual] | [remaining] | 🟢/🟡/🔴 |

### Error Budget Policy Actions

| Budget Remaining | Action                                            |
| ---------------- | ------------------------------------------------- |
| > 50%            | Normal operations                                 |
| 25-50%           | Review upcoming changes, increase testing         |
| 10-25%           | Freeze non-critical changes, focus on reliability |
| < 10%            | Freeze all changes, reliability sprint required   |

---

## Monitoring and Alerts

### Alert Response Times

| Condition                              | Response Time | Alert Channel             |
| -------------------------------------- | ------------- | ------------------------- |
| Latency target breached for 15 min     | < 30 min      | Slack #alerts             |
| Error rate exceeds threshold for 5 min | < 15 min      | Slack #alerts + PagerDuty |
| Realtime event lag exceeds 5 seconds   | < 5 min       | PagerDuty                 |
| Payment success rate < 90%             | Immediate     | PagerDuty                 |

### Dashboard Links

| Dashboard            | URL                                           | Purpose              |
| -------------------- | --------------------------------------------- | -------------------- |
| Grafana - Production | https://grafana.lole.app/d/lole-prod-overview | Real-time metrics    |
| Sentry - Errors      | https://sentry.io/organizations/lole          | Error tracking       |
| Vercel Analytics     | https://vercel.com/lole/analytics             | Frontend performance |

---

## Revision History

| Date       | Author           | Changes                                                                                                  |
| ---------- | ---------------- | -------------------------------------------------------------------------------------------------------- |
| 2026-02-17 | Engineering Team | Initial SLO definitions                                                                                  |
| 2026-04-04 | Engineering Team | Added validation checklist, measurement procedures, compliance report template, alerting recommendations |
