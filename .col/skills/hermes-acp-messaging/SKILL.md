---
name: hermes-acp-messaging
description: >
    Standardized Agent Communication Protocol (ACP) for inter-agent messaging
    in the Lole COL. Adapted from Hermes Agent (NousResearch/hermes-agent, MIT —
    acp_adapter/, acp_registry/). Defines the canonical envelope format for
    all agent-to-agent messages: task delegations, status reports, approval
    requests, and blocker notifications. Use whenever one agent needs to send
    a structured message to another agent in the COL hierarchy.
metadata:
    sources:
        - kind: github-dir
          repo: NousResearch/hermes-agent
          path: acp_adapter/
          attribution: NousResearch
          license: MIT
          usage: referenced
        - kind: github-dir
          repo: NousResearch/hermes-agent
          path: acp_registry/
          attribution: NousResearch
          license: MIT
          usage: referenced
---

# Hermes ACP Inter-Agent Messaging

A lightweight, file-based Agent Communication Protocol that lets every agent
in the Lole COL send and receive structured messages — without requiring a
running server.

---

## Core Principle

All inter-agent messages are **markdown files** written to a shared inbox
directory. The receiving agent reads and deletes them on the next heartbeat.
This is:

- **Asynchronous** — no agent needs to be "running" to receive a message
- **Durable** — messages persist even if the receiving agent crashes
- **Obsidian-visible** — every message is a human-readable note in the graph

---

## Message Envelope Format (ACP v1)

Every inter-agent message MUST follow this exact format:

```markdown
---
acp_version: '1.0'
message_id: '{uuid}'
message_type: '{type}'
from_agent: '{sender-slug}'
to_agent: '{receiver-slug}'
priority: '{low|normal|high|critical}'
created_at: '{ISO-8601}'
expires_at: '{ISO-8601 or null}'
requires_ack: { true|false }
parent_message_id: '{uuid or null}'
---

# {Message Subject}

{Message body in plain markdown}
```

**File path:**

```
.col/memory/inbox/{to_agent}/{message_id}.md
```

---

## Message Types

### 1. `task_delegation`

Sent by: Managers → Direct reports, VPs → Managers

```yaml
message_type: task_delegation
priority: normal
requires_ack: true
---
# Task: Implement RLS policy for orders table

**Context:** The VP of Security has identified a missing RLS policy on the
`orders` table per the weekly security audit.

**Acceptance Criteria:**
- [ ] Row-level security policy created
- [ ] Policy tested with Supabase test users
- [ ] Migration applied and verified

**Deadline:** Next heartbeat cycle
**File Boundaries:** supabase/migrations/
```

### 2. `status_report`

Sent by: Any agent → Their direct manager, on heartbeat completion

```yaml
message_type: status_report
priority: low
requires_ack: false
---
# Status: RLS Policy Implementation — COMPLETE

**Session ID:** {session-id}
**Duration:** 2 heartbeats
**Tokens Used:** ~4,200

## Completed
- Created migration `20260504_add_orders_rls.sql`
- Applied to Supabase staging — verified with 3 test tenants

## Next Action
Awaiting VP Security sign-off before production apply.
```

### 3. `blocker_notification`

Sent by: Any agent → Direct manager + the unblock owner

```yaml
message_type: blocker_notification
priority: high
requires_ack: true
---
# BLOCKED: Cannot apply ERCA migration — missing .pem certificate

**Blocked Task:** ERCA e-invoice signing implementation
**Blocked Since:** {timestamp}
**Unblock Owner:** compliance-manager
**Unblock Action Required:** Provide the production ERCA .pem certificate path

This task is paused until unblocked.
```

### 4. `request_board_approval`

Sent by: Any agent → CFO (budget) or CSO (security) or CEO (strategic)

```yaml
message_type: request_board_approval
priority: high
requires_ack: true
---
# Approval Request: Add Supabase Realtime subscription ($25/mo)

**Requested by:** eng-manager-core
**Cost Impact:** +$25/month recurring
**Justification:** Required for POS real-time order sync across KDS stations

**Alternatives Considered:**
1. Polling (rejected — too slow for KDS)
2. WebSockets via Next.js (rejected — stateless serverless limitation)

**Approver Required:** CFO (budget), CTO (technical)
```

### 5. `wiki_update_notification`

Sent by: Any agent → CEO + relevant VP

```yaml
message_type: wiki_update_notification
priority: low
requires_ack: false
---
# Wiki Updated: tech-stack-and-apis.md

**Updated by:** cto
**Change:** Added Supabase Realtime to approved integrations
**Reason:** Board approval received (ref: {approval-message-id})
**Location:** .col/memory/wiki/concepts/tech-stack-and-apis.md
```

### 6. `escalation`

Sent by: Any agent → N+2 level (skip one level for urgency)

```yaml
message_type: escalation
priority: critical
requires_ack: true
---
# ESCALATION: Production ERCA endpoint returning 503 for 2h

**Escalating from:** compliance-manager → vp-security → CSO
**Impact:** All fiscal receipts failing — Ethiopian law violation risk
**Current Status:** Retrying with exponential backoff. Not recovering.
**Immediate Action Needed:** CSO contact ERCA support directly.
```

---

## Inbox Protocol

### Reading Messages (on every heartbeat start)

1. Scan `.col/memory/inbox/{my-agent-slug}/` for any `.md` files
2. Sort by `priority` (critical → high → normal → low) then `created_at`
3. Process each message according to its `message_type`
4. If `requires_ack: true`, send an ACK reply before processing
5. Archive processed messages to `.col/memory/inbox/{my-slug}/archive/`

### Sending Messages (on every heartbeat end)

1. Generate a UUID for `message_id`
2. Write the ACP envelope to `.col/memory/inbox/{to_agent}/{message_id}.md`
3. If `requires_ack: true`, add the message ID to the sender's "awaiting ACK"
   list in their session file
4. Log all sent messages to `.col/memory/episodes/message-log.md`

### Expiry and Cleanup

- Messages with `expires_at` in the past: auto-delete on next inbox scan
- Messages without expiry: retain in archive for 30 days
- `critical` messages: never auto-delete, require manual resolution

---

## ACP Registry

The registry tracks all active inter-agent message threads. Maintained at:
`.col/memory/acp-registry.md`

```markdown
| Message ID | Type                   | From             | To               | Status      | Created | Expires |
| ---------- | ---------------------- | ---------------- | ---------------- | ----------- | ------- | ------- |
| {uuid}     | task_delegation        | cto              | eng-manager-core | pending_ack | ...     | ...     |
| {uuid}     | request_board_approval | eng-manager-core | cfo              | approved    | ...     | ...     |
```

---

## Source Reference

Adapted from `acp_adapter/` and `acp_registry/` in
[NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) (MIT License).
