# Incident Response Plan

Last updated: 2026-04-10
Scope: All lole production systems

## Purpose

This document defines the end-to-end incident response process for lole Restaurant OS. Use it when any production issue affects merchant operations, data integrity, or platform availability. It supplements the [Incident Triage Rubric](./incident-triage-rubric.md) with operational procedures, contact information, alerting configuration, and post-mortem guidelines.

**When to activate this plan:**

- An automated alert fires (Sentry, Prometheus, rate-limit abuse trigger)
- A merchant or staff member reports a production issue
- An on-call engineer detects an anomaly during routine monitoring

---

## Severity Levels

Reference: [Incident Triage Rubric](./incident-triage-rubric.md)

| Level    | Name     | Definition                                      | Acknowledge | Mitigate          | Examples                                                                                                       |
| -------- | -------- | ----------------------------------------------- | ----------- | ----------------- | -------------------------------------------------------------------------------------------------------------- |
| **Sev1** | Critical | Total system outage, data loss, security breach | 5 min       | 30 min            | POS completely offline, all payments down, database inaccessible, guest data breach                            |
| **Sev2** | Major    | Major feature degraded, significant user impact | 15 min      | 2 h               | Single payment provider down, KDS not receiving orders, realtime sync broken, 3+ restaurants unable to operate |
| **Sev3** | Partial  | Minor feature impact, workaround available      | 60 min      | Next business day | Slow performance (>2s latency), single restaurant affected, offline mode fallback active                       |
| **Sev4** | Minor    | Cosmetic, no user impact                        | Next sprint | During sprint     | Non-critical feature bug, cosmetic issues, single user reports                                                 |

When in doubt, classify at the higher severity and downgrade as you learn more.

---

## Contact Information

| Role             | Contact Method                   | Details                                             |
| ---------------- | -------------------------------- | --------------------------------------------------- |
| On-call Engineer | PagerDuty schedule `lole-oncall` | Primary first responder                             |
| Engineering Lead | Telegram + Phone                 | [NAME], Telegram: @[handle], Phone: [+251-XXX-XXXX] |
| CTO              | Telegram + Phone                 | [NAME], Telegram: @[handle], Phone: [+251-XXX-XXXX] |
| Supabase Support | Email                            | support@supabase.com                                |
| Upstash Support  | Email                            | support@upstash.com                                 |
| Vercel Support   | Web                              | vercel.com/support                                  |

**Escalation chain:** Primary on-call → Secondary on-call → Engineering Lead → CTO

---

## On-Call Schedule

- **Rotation:** Weekly rotation among senior engineers
- **Structure:** Primary on-call (first responder) + Secondary on-call (backup)
- **Handoff:** Monday 09:00 EAT via PagerDuty schedule
- **No-deploy windows:** Friday 18:00 – Sunday 22:00 EAT
    - No scheduled deployments during this window
    - Emergency hotfixes only (must be documented and reviewed within 48 hours)

---

## Alerting Configuration

| Alert Type        | Tool            | Condition                                       | Notification Channel              |
| ----------------- | --------------- | ----------------------------------------------- | --------------------------------- |
| Uptime monitoring | Prometheus      | 60s poll interval, any non-200 response         | PagerDuty → Telegram #incidents   |
| Error rate        | Sentry          | >1% error rate over 5-minute window             | PagerDuty → Telegram #incidents   |
| Performance       | Sentry / Vercel | P95 latency breach on P0 endpoints              | Telegram #engineering             |
| Rate limit abuse  | Application     | `checkRateLimitAbuse()` triggers                | Telegram #engineering + PagerDuty |
| Database health   | Supabase        | Connection pool exhaustion, replication lag >5s | PagerDuty → Telegram #incidents   |

**P0 endpoints monitored for latency:**

- `GET /api/merchant/command-center` — P95 <= 500ms
- `GET /api/orders` — P95 <= 400ms
- `PATCH /api/orders/:id/status` — P95 <= 300ms

---

## Incident Workflow

### Step 1: Detect

- Automated alert fires from monitoring (PagerDuty, Prometheus, Sentry)
- User report via Telegram, phone, or in-app feedback
- On-call engineer observes anomaly during routine check

### Step 2: Classify

Assign severity using the [severity matrix](#severity-levels). When uncertain, start at Sev1 and downgrade.

### Step 3: Assign Incident Commander

For Sev1/Sev2, an **Incident Commander (IC)** must be assigned immediately:

1. First responder acknowledges and creates incident channel: `#incident-YYYYMMDD-brief`
2. First responder posts: `@here SevX incident declared. I am Incident Commander until relieved.`
3. IC coordinates all responders, makes time-critical decisions, and owns communication
4. Handoff with explicit statement: `@replacement You are now IC for this incident.`

For Sev3/Sev4, the first responder acts as de facto IC without requiring a dedicated channel.

### Step 4: Mitigate

Apply mitigations in priority order:

1. **Feature flag kill switch** — Fastest option (< 2 min). See [Feature Flag Kill Switch Integration](#feature-flag-kill-switch-integration).
2. **Deploy rollback** — Revert to last known good deployment (2–5 min). See [Rollback Procedures](./../08-reports/rollout/rollback-procedures-enhanced.md).
3. **Hotfix** — If rollback is insufficient, deploy a targeted fix.

Mitigation priority order:

1. Stop data loss / security exposure
2. Restore core ordering/payment functionality
3. Restore secondary features
4. Investigate root cause

### Step 5: Communicate

Post updates at fixed intervals:

| Severity | Update Frequency | Channel                                    |
| -------- | ---------------- | ------------------------------------------ |
| Sev1     | Every 15 minutes | Telegram #incidents + merchant status page |
| Sev2     | Every 30 minutes | Telegram #incidents                        |
| Sev3     | Every 2 hours    | Telegram #engineering                      |
| Sev4     | As needed        | Telegram #engineering                      |

Use the communication templates from the [Incident Triage Rubric](./incident-triage-rubric.md#communication-templates).

### Step 6: Resolve

1. Apply permanent fix or confirm rollback is stable
2. Verify system health via command center dashboard
3. Monitor for 30 minutes post-resolution
4. Announce resolution in incident channel
5. Record incident with all required fields (see [Incident Triage Rubric](./incident-triage-rubric.md#required-incident-record-fields))

### Step 7: Post-Incident Review

- **Sev1:** Full blameless post-mortem within 48 hours
- **Sev2:** Post-incident summary within 48 hours, post-mortem optional
- **Sev3/Sev4:** Track action items in backlog, no formal review required

See [Post-Mortem Template](#post-mortem-template) and [Blameless Post-Mortem Guidelines](#blameless-post-mortem-guidelines).

---

## Feature Flag Kill Switch Integration

Feature flags are the fastest mitigation lever. Use these emergency switches to stop the bleeding while investigating:

| Kill Switch                           | Effect                                                     | Use Case                                                                       |
| ------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `PILOT_BLOCK_MUTATIONS=true`          | Blocks all write operations platform-wide. Read-only mode. | Unknown root cause, potential data corruption, need to stop writes immediately |
| `ENABLE_P0_PILOT_ROLLOUT=false`       | Disables P0 pilot features                                 | P0 rollout causing issues for pilot restaurants                                |
| `ENABLE_P1_PILOT_ROLLOUT=false`       | Disables P1 pilot features                                 | P1 rollout causing issues for pilot restaurants                                |
| `FEATURE_KILL_TELEBIRR_PAYMENTS=true` | Disables all Telebirr payments                             | Telebirr payment processing errors                                             |
| `FEATURE_KILL_CHAPA_PAYMENTS=true`    | Disables all Chapa payments                                | Chapa payment processing errors                                                |
| `FEATURE_KILL_ERCA_SUBMISSIONS=true`  | Disables ERCA e-invoice submissions                        | ERCA submission failures or errors                                             |
| `RATE_LIMIT_ENABLED=false`            | Disables rate limiting                                     | Rate limiter itself is causing issues (use with extreme caution)               |
| `ENABLE_OFFLINE_MODE=false`           | Forces online-only mode                                    | Offline sync causing data conflicts or staleness                               |

**How to apply:** Update the environment variable in Vercel dashboard → Settings → Environment Variables, then trigger a redeploy. Change takes effect within 60 seconds.

**Caution:** `RATE_LIMIT_ENABLED=false` removes abuse protection. Only use this if the rate limiter itself is the source of the incident. Re-enable as soon as possible.

---

## Post-Mortem Template

Copy this template for each Sev1/Sev2 post-mortem:

```markdown
# Post-Mortem: INC-YYYYMMDD-NNN

## Incident ID: INC-YYYYMMDD-NNN

## Severity: [Sev1/Sev2]

## Duration: [Start time] – [End time] ([X hours Y minutes])

## Impact

- **Users affected:** [Number of restaurants, staff, guests]
- **Revenue impact:** [Estimated order volume lost or delayed]

## Timeline (UTC)

| Time  | Event                     |
| ----- | ------------------------- |
| HH:MM | [Detection / alert fired] |
| HH:MM | [IC assigned]             |
| HH:MM | [Mitigation applied]      |
| HH:MM | [Resolution confirmed]    |

## Root Cause

[Detailed technical explanation of what caused the incident]

## Contributing Factors

- [Factor 1]
- [Factor 2]
- [Factor 3]

## Remediation Actions

| Action     | Owner  | Deadline | Status                  |
| ---------- | ------ | -------- | ----------------------- |
| [Action 1] | [Name] | [Date]   | [Open/In Progress/Done] |
| [Action 2] | [Name] | [Date]   | [Open/In Progress/Done] |

## Lessons Learned

- [Lesson 1]
- [Lesson 2]

## Action Items

- [ ] [Action item with owner and deadline]
- [ ] [Action item with owner and deadline]
```

---

## Weekend and Holiday Procedures

- **Extended response times:** During no-deploy windows (Friday 18:00 – Sunday 22:00 EAT), allow 2x normal response times for Sev2–Sev4.
- **Sev1 remains unchanged:** 5-minute acknowledgement and 30-minute mitigation targets still apply regardless of day or time.
- **No scheduled deployments:** Friday 18:00 – Sunday 22:00 EAT. Emergency hotfixes are the only exception and must be documented.
- **Holiday coverage:** For Ethiopian public holidays, designate a specific on-call engineer in advance. Post the holiday on-call schedule in Telegram #engineering at least 48 hours before the holiday.

---

## Disaster Recovery Cross-Reference

For infrastructure-level failures (region outage, database cluster failure, total Vercel outage), see the disaster recovery procedures:

→ [docs/05-infrastructure/disaster-recovery.md](./../05-infrastructure/disaster-recovery.md)

The incident response plan handles application-level and operational incidents. Disaster recovery handles infrastructure-level catastrophes.

---

## Blameless Post-Mortem Guidelines

### Principles

1. **Focus on systems and processes, not individuals.** Every question in a post-mortem should be about _why the system allowed this to happen_, not _who made the mistake_.
2. **No disciplinary action from post-mortem findings.** Post-mortems are learning exercises. Actions taken based on post-mortem findings must improve systems, not punish people.
3. **Everyone involved contributes.** All responders and stakeholders should provide their perspective. Different viewpoints reveal different contributing factors.
4. **Action items must have clear owners and deadlines.** Every action item from a post-mortem must have a named owner and a specific deadline. Vague or unowned action items are not actionable.

### Facilitation

- The IC or a designated facilitator runs the post-mortem meeting
- Keep the meeting to 60 minutes maximum
- Share the written post-mortem document 24 hours before the meeting for async review
- Focus discussion on contributing factors and remediation, not re-litigating the timeline

### Anti-Patterns to Avoid

- "Engineer X pushed the bad commit" → Instead: "What review process allowed this change to reach production without detection?"
- "Human error" → Instead: "What safeguards, automation, or checks could have prevented or caught this?"
- "We need to be more careful" → Instead: "What specific process or tool change will make this class of error impossible or detectable?"

---

## Related Documentation

- [Incident Triage Rubric](./incident-triage-rubric.md)
- [Rollback Procedures (Enhanced)](./../08-reports/rollout/rollback-procedures-enhanced.md)
- [P0 Release Readiness and Rollback](./../08-reports/rollout/p0-release-readiness-and-rollback.md)
- [Feature Flags & Release Strategy](./../03-product/feature-flags.md)
- [Disaster Recovery](./../05-infrastructure/disaster-recovery.md)
