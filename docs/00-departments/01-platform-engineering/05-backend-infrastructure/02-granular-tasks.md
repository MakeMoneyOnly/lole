# Backend Infrastructure - Granular Tasks

**Department:** Platform Engineering  
**Functional Unit:** Backend Infrastructure  
**Document Version:** 1.0  
**Last Updated:** 2026-05-02

---

## Overview

This document contains granular, actionable tasks derived from the audit findings for the Backend Infrastructure functional unit. Each task is designed to be completed by a single developer within 1-5 days and includes specific acceptance criteria, technical requirements, and dependencies.

---

## Task Categories

### 🔴 Critical Priority Tasks (Must Complete Immediately)

#### Task 1.1: Deploy Apollo Router for GraphQL Federation

**Estimated Effort:** 5 days  
**Assigned To:** [Backend Engineer]  
**Status:** Not Started  
**Dependencies:** None

**Description:**  
Deploy Apollo Router to enable GraphQL federation. Configure subgraphs for orders, menu, payments, guests, and staff. Set up Apollo GraphOS publishing for schema management.

**Technical Requirements:**

```yaml
# router.yaml
supergraph:
    listen: 0.0.0.0:4000
    cors:
        origins:
            - 'https://app.example.com'
        allow_credentials: true

subgraphs:
    orders:
        routing_url: ${ORDERS_SUBGRAPH_URL}
    menu:
        routing_url: ${MENU_SUBGRAPH_URL}
    payments:
        routing_url: ${PAYMENTS_SUBGRAPH_URL}
    guests:
        routing_url: ${GUESTS_SUBGRAPH_URL}
    staff:
        routing_url: ${STAFF_SUBGRAPH_URL}
```

**Files to Modify:**

- `router/router.yaml` - New file
- `docker-compose.yml` - Add router service
- `src/app/api/subgraphs/*/route.ts` - Update subgraph endpoints
- `.github/workflows/deploy-router.yml` - New file

**Acceptance Criteria:**

- [ ] Apollo Router deployed and running
- [ ] All 5 subgraphs connected
- [ ] GraphQL queries working through federation
- [ ] Error handling implemented
- [ ] Monitoring configured
- [ ] Deployment documented

**Test Cases:**

1. Query orders with menu items
2. Query guests with loyalty data
3. Query payments with order data
4. Verify CORS configuration
5. Test error responses

**Review Checklist:**

- [ ] Router configuration valid
- [ ] Subgraph URLs correct
- [ ] Security headers added
- [ ] Logging configured
- [ ] Documentation updated

---

#### Task 1.2: Implement Edge Functions Foundation

**Estimated Effort:** 6 days  
**Assigned To:** [Backend Engineer]  
**Status:** Not Started  
**Dependencies:** Task 1.1

**Description:**  
Create Edge Functions directory structure and implement webhook processing function for payment providers (Chapa, Telebirr) and delivery partners.

**Technical Requirements:**

```typescript
// supabase/functions/webhook-handler/index.ts
import 'jsr:@supabase/functions-js/std@0.1.0';

Deno.serve(async (req: Request) => {
    const signature = req.headers.get('x-signature');
    const payload = await req.json();

    // Verify webhook signature
    const isValid = await verifySignature(payload, signature);
    if (!isValid) {
        return new Response('Invalid signature', { status: 401 });
    }

    // Process webhook based on type
    const result = await processWebhook(payload);

    return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
    });
});

async function verifySignature(payload: unknown, signature: string | null): Promise<boolean> {
    // Implementation for HMAC verification
    return true;
}
```

**Files to Modify:**

- `supabase/functions/webhook-handler/index.ts` - New file
- `supabase/functions/webhook-handler/deno.json` - New file
- `supabase/functions/webhook-handler/import_map.json` - New file

**Acceptance Criteria:**

- [ ] Edge Functions directory populated
- [ ] Webhook handler accepts all provider webhooks
- [ ] Signature verification implemented
- [ ] Error handling with proper responses
- [ ] Unit tests for webhook processing
- [ ] Integration tests with mock providers

**Test Cases:**

1. Valid Chapa webhook
2. Valid Telebirr webhook
3. Invalid signature rejection
4. Unknown webhook type handling
5. Retry on failure

**Review Checklist:**

- [ ] Signature verification secure
- [ ] Error responses proper
- [ ] Logging implemented
- [ ] No secrets in code
- [ ] Documentation complete

---

#### Task 1.3: Consolidate Migration Files

**Estimated Effort:** 10 days  
**Assigned To:** [Database Engineer]  
**Status:** Not Started  
**Dependencies:** None

**Description:**  
Consolidate 32 advisor-related migration files into logical groups. Establish clear migration naming conventions and documentation.

**Technical Requirements:**

```sql
-- Consolidated migration file structure
-- 20260401_consolidated_advisor_cleanup_p0.sql
-- Contains: advisor index cleanup files (group 1)
-- Purpose: Remove unused indexes from advisory findings

-- 20260402_consolidated_advisor_cleanup_p1.sql
-- Contains: advisor security hardening files (group 2)
-- Purpose: Security invoker views and additional fixes

-- 20260403_consolidated_advisor_cleanup_p2.sql
-- Contains: remaining advisor-related files (group 3)
-- Purpose: Final consolidation and cleanup
```

**Files to Modify:**

- `supabase/migrations/20260401_consolidated_advisor_cleanup_p0.sql` - New file
- `supabase/migrations/20260402_consolidated_advisor_cleanup_p1.sql` - New file
- `supabase/migrations/20260403_consolidated_advisor_cleanup_p2.sql` - New file
- `supabase/migrations/README.md` - Update with categorization

**Acceptance Criteria:**

- [ ] 32 advisor-related migrations consolidated into logical groups
- [ ] Clear naming convention established
- [ ] Migration categories documented
- [ ] Baseline state documented
- [ ] Rollback paths verified

**Test Cases:**

1. Apply consolidated migrations to fresh database
2. Verify index counts match expectations
3. Test rollback scenarios
4. Compare before/after migration counts

**Review Checklist:**

- [ ] SQL syntax correct
- [ ] No data loss in consolidation
- [ ] Rollback statements included
- [ ] Comments explain changes
- [ ] Documentation updated

---

## 🟠 High Priority Tasks

#### Task 2.1: Implement Background Job Edge Functions

**Estimated Effort:** 5 days  
**Assigned To:** [Backend Engineer]  
**Status:** Not Started  
**Dependencies:** Task 1.2

**Description:**  
Create Edge Functions for payment retries, notification processing, and delivery webhook handling with QStash integration.

**Technical Requirements:**

```typescript
// supabase/functions/payment-retry/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async req => {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get payments needing retry
    const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('status', 'pending')
        .lte('retry_count', 3);

    // Process each payment
    for (const payment of payments || []) {
        await processPaymentRetry(payment);
    }

    return new Response('OK');
});
```

**Files to Modify:**

- `supabase/functions/payment-retry/index.ts` - New file
- `supabase/functions/notification-processor/index.ts` - New file
- `supabase/functions/delivery-webhook/index.ts` - New file

**Acceptance Criteria:**

- [ ] Payment retry function implemented
- [ ] Notification processor implemented
- [ ] Delivery webhook function implemented
- [ ] QStash integration working
- [ ] Retry logic with exponential backoff
- [ ] Unit tests for each function

**Test Cases:**

1. Process pending payment
2. Notification queue empty
3. Delivery webhook received
4. Retry after failure
5. Max retries exceeded

---

#### Task 2.3: Implement Scheduled Task Processing

**Estimated Effort:** 4 days  
**Assigned To:** [Backend Engineer]  
**Status:** Not Started  
**Dependencies:** Task 2.1

**Description:**  
Create Edge Functions for scheduled tasks like daily reports, ERCA submissions, and data cleanup.

**Technical Requirements:**

```typescript
// supabase/functions/daily-reports/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async req => {
    const url = new URL(req.url);
    const task = url.searchParams.get('task');

    switch (task) {
        case 'revenue_report':
            await generateRevenueReport();
            break;
        case 'erca_submission':
            await submitErcaReport();
            break;
        default:
            return new Response('Invalid task', { status: 400 });
    }

    return new Response('Task completed');
});
```

**Files to Modify:**

- `supabase/functions/daily-reports/index.ts` - New file
- `supabase/functions/erca-submission/index.ts` - New file
- `supabase/functions/data-cleanup/index.ts` - New file

---

## 🟡 Medium Priority Tasks

#### Task 3.1: Document API Versioning Strategy

**Estimated Effort:** 3 days  
**Assigned To:** [Backend Engineer]  
**Status:** Not Started  
**Dependencies:** None

**Description:**  
Document API versioning strategy, deprecation policy, and create OpenAPI specification.

---

#### Task 3.2: Implement RLS Monitoring Dashboard

**Estimated Effort:** 4 days  
**Assigned To:** [Database Engineer]  
**Status:** Not Started  
**Dependencies:** Task 1.3

**Description:**  
Create monitoring dashboard for RLS policy health and violations.

---

#### Task 3.3: Implement Migration Testing Pipeline

**Estimated Effort:** 5 days  
**Assigned To:** [DevOps Engineer]  
**Status:** Not Started  
**Dependencies:** Task 1.3

**Description:**  
Create automated pipeline for testing migrations before production deployment.

---

#### Task 3.4: Implement Dead Letter Queue

**Estimated Effort:** 3 days  
**Assigned To:** [Backend Engineer]  
**Status:** Not Started  
**Dependencies:** Task 2.1

**Description:**  
Create dead letter queue table and handling for failed background jobs.

---

## 📊 Task Dependencies

```
Task 1.1 (Apollo Router) ──┬── Task 1.2 (Edge Functions) ──┬── Task 2.1 (Background Jobs)
                           │                               ├── Task 2.3 (Scheduled Tasks)
                           │                               └── Task 3.4 (Dead Letter Queue)
                           │
Task 1.3 (Migrations) ─────┼── Task 3.2 (RLS Monitoring)
                           │
                           └── Task 3.3 (Migration Testing)
```

---

## 📅 Implementation Timeline

### Week 1-3: Critical Infrastructure

- Days 1-5: Task 1.1 (Apollo Router)
- Days 6-12: Task 1.2 (Edge Functions)
- Days 13-20: Task 1.3 (Migrations)

### Week 4-5: High Priority

- Days 21-25: Task 2.1 (Background Jobs)
- Days 26-28: Task 2.3 (Scheduled Tasks)

### Week 6: Medium Priority

- Days 29-31: Task 3.1 (API Docs)
- Days 32-35: Task 3.2 (RLS Monitoring)

### Week 7-8: Medium Priority

- Days 36-39: Task 3.3 (Testing Pipeline)
- Days 40-42: Task 3.4 (Dead Letter Queue)

### Week 9-10: Polish

- Days 43-45: Documentation updates
- Days 46-50: Final testing and verification

---

## 📈 Success Metrics

### Infrastructure Metrics

- [ ] GraphQL federation operational
- [ ] Edge Functions deployed and monitored
- [ ] Background job success rate > 99%
- [ ] Migration count reduced by 30%

### Security Metrics

- [ ] RLS policy audit complete
- [ ] Webhook verification active (already implemented)
- [ ] Security advisor findings addressed
- [ ] Audit compliance achieved

### Performance Metrics

- [ ] Edge Function cold start < 50ms
- [ ] Background job processing SLA met
- [ ] API response time improvement
- [ ] Error rate < 0.1%

---

## 🔄 Task Status Tracking

| Task ID | Title             | Assignee | Status      | Progress | Due Date   |
| ------- | ----------------- | -------- | ----------- | -------- | ---------- |
| 1.1     | Apollo Router     |          | Not Started | 0%       | 2026-05-12 |
| 1.2     | Edge Functions    |          | Not Started | 0%       | 2026-05-18 |
| 1.3     | Migrations        |          | Not Started | 0%       | 2026-05-25 |
| 2.1     | Background Jobs   |          | Not Started | 0%       | 2026-05-28 |
| 2.3     | Scheduled Tasks   |          | Not Started | 0%       | 2026-06-01 |
| 3.1     | API Docs          |          | Not Started | 0%       | 2026-06-03 |
| 3.2     | RLS Monitoring    |          | Not Started | 0%       | 2026-06-05 |
| 3.3     | Testing Pipeline  |          | Not Started | 0%       | 2026-06-08 |
| 3.4     | Dead Letter Queue |          | Not Started | 0%       | 2026-06-10 |

---

**Document Owner:** Platform Engineering Team  
**Last Updated:** 2026-05-02  
**Next Review:** 2026-05-09
