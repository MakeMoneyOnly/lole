# Incident Triage Workflow and Severity Rubric

## Overview

This document defines incident handling procedures for lole Restaurant OS. All team members should be familiar with these procedures before an incident occurs.

---

## Severity Levels

| Level    | Name     | Definition                                                                  | Examples                                                                                                              |
| -------- | -------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Sev1** | Critical | Complete outage or data exposure affecting core ordering/payment operations | POS completely offline, all payment processing down, database inaccessible, guest data breach                         |
| **Sev2** | Major    | Significant degradation of core flows with no workaround                    | Single payment provider down, KDS not receiving orders, realtime sync broken, 3+ restaurants unable to process orders |
| **Sev3** | Partial  | Degradation with workaround available                                       | Slow performance (>2s latency), single restaurant affected, offline mode fallback active                              |
| **Sev4** | Minor    | Low operational impact                                                      | Non-critical feature bug, cosmetic issues, single user reports                                                        |

---

## Response Time Targets

| Severity | Acknowledge | Mitigation        | Resolution         |
| -------- | ----------- | ----------------- | ------------------ |
| Sev1     | 5 minutes   | 30 minutes        | 4 hours            |
| Sev2     | 15 minutes  | 2 hours           | 24 hours           |
| Sev3     | 60 minutes  | Next business day | 1 week             |
| Sev4     | Next sprint | During sprint     | Tracked in backlog |

---

## Incident Commander Assignment

### Automatic Assignment Rules

1. **Primary On-Call**: Check PagerDuty/Opsgenie schedule for current on-call engineer
2. **Fallback Chain**:
    - Primary on-call → Secondary on-call
    - Secondary → Engineering Lead
    - Engineering Lead → CTO

### Manual Assignment (for Sev1/Sev2)

When an incident is declared Sev1 or Sev2, an **Incident Commander (IC)** must be assigned immediately:

**IC Responsibilities:**

- Own the incident from detection to post-mortem
- Coordinate all responders
- Make time-critical decisions
- Communicate status to stakeholders
- Ensure incident record is complete

**IC Assignment Procedure:**

1. First responder acknowledges and creates incident channel: `#incident-YYYYMMDD-brief`
2. First responder posts: `@here SevX incident declared. I am Incident Commander until relieved.`
3. If first responder cannot continue, hand off with: `@replacement You are now IC for this incident.`
4. Log IC assignment in incident record

---

## Triage Workflow

### Step 1: Detect and Acknowledge

```
1. Alert fires from monitoring (Telegram/PagerDuty)
2. On-call engineer acknowledges within target time
3. Create incident channel: #incident-YYYYMMDD-description
4. Post initial assessment in channel
```

### Step 2: Classify Severity

Use the severity matrix above. When in doubt, start higher and downgrade as you learn more.

### Step 3: Assign Incident Commander

For Sev1/Sev2, follow the IC assignment procedure above.

### Step 4: Mitigate Customer Impact

**Priority order:**

1. Stop data loss / security exposure
2. Restore core ordering/payment functionality
3. Restore secondary features
4. Investigate root cause

**Mitigation options:**

- Feature flag disable
- Rollback deployment
- Failover to backup
- Manual intervention

### Step 5: Communicate Updates

Post updates at fixed intervals:

- Sev1: Every 15 minutes
- Sev2: Every 30 minutes
- Sev3: Every 2 hours
- Sev4: As needed

### Step 6: Resolve, Validate, and Monitor

1. Apply permanent fix or confirm rollback
2. Verify system health via command center dashboard
3. Monitor for 30 minutes post-resolution
4. Announce resolution in incident channel

### Step 7: Post-Incident Summary

Within 24 hours of Sev1/Sev2 resolution:

- Publish post-incident summary
- List action items with owners and due dates
- Schedule blameless post-mortem (Sev1 only)

---

## Communication Templates

### Incident Declaration (English)

```
🔴 INCIDENT DECLARED - SevX

**Summary:** [Brief description]
**Impact:** [Who/what is affected]
**IC:** @username
**Channel:** #incident-YYYYMMDD-description

Please acknowledge if you are on-call.
```

### Incident Declaration (Amharic - አማርኛ)

```
🔴 አደጋ ተከስቷል - SevX

**ማጠቃለያ:** [አጭር መግለጫ]
**ተጽዕኖ:** [ማን/ምን ተጽዕኖ አድሯል]
**ተቆጣጣሪ:** @username
**ቻናል:** #incident-YYYYMMDD-description

እባክዎ የድጋፍ ጊዜ ከነበረዎ ከሆነ ያሳውቁን።
```

### Status Update (English)

```
📊 STATUS UPDATE - [Time]

**Current State:** [Investigating/Mitigating/Resolved]
**Actions Taken:** [What was done]
**Next Steps:** [What's next]
**ETA:** [Expected resolution time or N/A]

IC: @username
```

### Status Update (Amharic - አማርኛ)

```
📊 ሁኔታ አመልካች - [ሰዓት]

**አሁን ያለ ሁኔታ:** [በመመርመር ላይ/በመቆጣጠር ላይ/ተፈትቷል]
**የተወሰዱ እርምጎች:** [ምን ተደርጓል]
**ቀጣይ ምንደርጎች:** [ምን ይከተላል]
**የሚገመት ጊዜ:** [የመፍትሄ ጊዜ ወይም N/A]

ተቆጣጣሪ: @username
```

### Resolution (English)

```
✅ INCIDENT RESOLVED

**Duration:** [X hours Y minutes]
**Root Cause:** [Brief explanation]
**Fix Applied:** [What fixed it]
**Post-Incident:** [Link to post-mortem when ready]

Thank you to all responders. IC signing off.
```

### Resolution (Amharic - አማርኛ)

```
✅ አደጋ ተፈትቷል

**የዘለቀው ጊዜ:** [X ሰዓት Y ደቂቃ]
**ዋና ምክንያት:** [አጭር ማብራሪያ]
**የተጠቀመው መፍትሄ:** [ምን አስተካከለ]
**ከአደጋ በኋላ:** [ሊንክ ወደ ማስተርትዮ]

ለሁሉም አስተባባሪዎች እናመሰግናለን። ተቆጣጣሪ እየተቆጠረ ነው።
```

---

## Required Incident Record Fields

Every incident must have these fields recorded:

| Field                    | Description                               |
| ------------------------ | ----------------------------------------- |
| **Incident ID**          | Format: `INC-YYYYMMDD-NNN`                |
| **Start Time**           | When the incident was first detected      |
| **Detection Method**     | Alert, user report, internal monitoring   |
| **Severity**             | Sev1/2/3/4                                |
| **Impacted Components**  | Services, APIs, database tables affected  |
| **User/Merchant Impact** | Number of affected restaurants, guests    |
| **Root Cause Summary**   | Brief explanation of what caused it       |
| **Mitigation**           | How customer impact was stopped           |
| **Permanent Fix**        | Long-term resolution (or N/A if pending)  |
| **Action Items**         | Follow-up tasks with owners and due dates |
| **Post-Mortem Link**     | Link to detailed post-mortem (Sev1 only)  |

---

## Escalation Contacts

| Role              | Contact Method   | Response Time      |
| ----------------- | ---------------- | ------------------ |
| Primary On-Call   | PagerDuty        | 5 min              |
| Secondary On-Call | PagerDuty        | 15 min             |
| Engineering Lead  | Telegram + Phone | 30 min             |
| CTO               | Phone            | 1 hour (Sev1 only) |

---

## External Communication

### Merchant-Facing (Sev1/Sev2)

For incidents affecting merchants, prepare a status message:

**English:**

> We are currently experiencing issues with [service]. Our team is working to resolve this. Orders may be [delayed/unavailable]. We apologize for the inconvenience.

**Amharic:**

> በአሁኑ ጊዜ በ[አገልግሎት] ላይ ችግር እያጋጠምን ነው። ቡድናችን ለመፍትሄ እየሰራ ነው። ትዕዛዝ [ሊዘገው/ሊሆን የማይችል] ይሆናል። ለማስቸገራችሁ እንቃኙራለን።

---

## Related Documents

- [Database Migrations Runbook](./database-migrations.md)
- [Payment Gateway Outages](./payment-gateway-outages.md)
- [KDS & Printer Failures](./kds-printer-failures.md)
- [ERCA Integration](./erca-integration.md)
- [Telebirr/Chapa Integration](./telebirr-chapa-integration.md)
