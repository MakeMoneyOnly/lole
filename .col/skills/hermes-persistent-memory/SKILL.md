---
name: hermes-persistent-memory
description: >
    Persistent cross-session memory for all COL agents using a WAL-mode SQLite
    database with FTS5 full-text search. Adapted from Hermes Agent
    (NousResearch/hermes-agent, MIT). Use when an agent needs to recall past
    decisions, search prior sessions, or persist knowledge between heartbeats.
    Triggers on: "search memory", "what did we decide about X", "recall past
    session", "persist this knowledge", or any cross-session context retrieval.
metadata:
    sources:
        - kind: github-file
          repo: NousResearch/hermes-agent
          path: hermes_state.py
          attribution: NousResearch
          license: MIT
          usage: referenced
---

# Hermes Persistent Memory

Cross-session, searchable memory for every COL agent. Every agent heartbeat
writes its decisions and discoveries to a shared SQLite state store — and can
full-text search the entire corpus of past sessions.

---

## Architecture

```
.col/memory/sessions/
├── state.db          ← WAL-mode SQLite (the source of truth)
├── schema.sql        ← Schema reference (do not edit manually)
└── index/            ← FTS5 trigram search index (auto-maintained)
```

The database runs in **WAL (Write-Ahead Logging)** mode, which allows:

- **Multiple concurrent readers** (all 23 departments reading simultaneously)
- **Single writer** at a time (with jitter-retry on contention)

---

## Schema (from hermes_state.py)

```sql
-- Sessions: one row per agent heartbeat session
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,         -- which agent/department created this
    user_id TEXT,                 -- the human operator (if applicable)
    model TEXT,                   -- LLM model used
    started_at REAL NOT NULL,
    ended_at REAL,
    end_reason TEXT,              -- 'compression', 'complete', 'blocked'
    parent_session_id TEXT,       -- for session chains after compression
    message_count INTEGER DEFAULT 0,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    estimated_cost_usd REAL,
    title TEXT                    -- auto-generated session title
);

-- Messages: every agent thought and tool call
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    role TEXT NOT NULL,           -- 'system','user','assistant','tool'
    content TEXT,
    tool_name TEXT,
    timestamp REAL NOT NULL,
    reasoning TEXT                -- chain-of-thought reasoning (if captured)
);

-- Full-text search (standard tokenizer)
CREATE VIRTUAL TABLE messages_fts USING fts5(content);

-- Trigram FTS for substring/CJK search
CREATE VIRTUAL TABLE messages_fts_trigram USING fts5(content, tokenize='trigram');
```

---

## How Agents Use This Skill

### Step 1: Write to Memory (End of Heartbeat)

At the END of every heartbeat cycle, each agent MUST persist a summary of
what it did to the sessions table. Format:

```markdown
SESSION: {agent-slug}-{YYYY-MM-DD-HH}
SOURCE: {department-name}
TITLE: {one-line description of what was accomplished}
DECISIONS:

- {key decision 1}
- {key decision 2}
  BLOCKERS:
- {blocker} → owned by {agent}
  NEXT: {what the next heartbeat should pick up}
```

Write this to: `.col/memory/sessions/{agent-slug}-{timestamp}.md`

### Step 2: Search Memory (Start of Heartbeat)

At the START of every heartbeat, before doing any work, agents MUST search
the memory corpus for relevant prior context. Use these patterns:

**Search for a topic:**

```
SEARCH: "ERCA compliance" in sessions WHERE source = 'compliance-manager'
```

**Search for a recent decision:**

```
SEARCH: "PowerSync" in sessions WHERE started_at > (now - 7 days)
```

**Follow session chains (after compression):**

```
RESOLVE: parent_session_id chain for session {id}
```

### Step 3: Write Retention Policy

- **Executive sessions** (CEO, CTO, C-Suite): retain forever
- **VP sessions**: retain 90 days
- **Manager/Department sessions**: retain 30 days
- **Ghost sessions** (no messages, >24h old): auto-prune

---

## Write Contention Protocol

When multiple agents write simultaneously (common during parallel department
execution), the writer MUST use **jitter retry**:

```
MAX_RETRIES = 15
RETRY_MIN   = 20ms
RETRY_MAX   = 150ms

On "database is locked":
  sleep(random(RETRY_MIN, RETRY_MAX))
  retry
```

WAL checkpoint is triggered every 50 successful writes to prevent log bloat.

---

## Session Continuity (Branch & Resume)

Sessions can be **branched** when a long task is split across multiple
heartbeats. Each branch records its `parent_session_id`:

```
session-A (original task)
  └─ session-B (branched after context compression)
       └─ session-C (continued after blocker resolved)
```

To resume: resolve the parent chain and inject the compressed summary as
system context for the new session.

---

## Integration with COL Orchestrator

The Orchestrator (`/.col/orchestrator/`) reads the memory store to:

1. Build the **CEO Daily Brief** from top-N recent sessions
2. Power the **Epistemic Audit** (wiki vs. reality drift detection)
3. Generate the **Insights Report** (see `hermes-insights-loop` skill)

---

## Source Reference

Adapted from `hermes_state.py` in [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) (MIT License).
Key adaptations for Lole COL:

- Markdown-file persistence layer (Obsidian-compatible) alongside SQLite
- Department/agent-aware `source` tagging
- Integrated with `.col/memory/wiki/` wiki-grounding system
