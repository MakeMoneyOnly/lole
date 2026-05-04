---
name: hermes-context-compressor
description: >
    Compress an agent's context window when approaching token limits, using the
    Hermes trajectory compression algorithm (NousResearch/hermes-agent, MIT).
    Protects head turns (system prompt, first user message) and tail turns
    (last 4 exchanges), summarizes the compressible middle region using an LLM.
    Use when an agent reports "context window filling", "approaching token limit",
    or when a session has >15,000 tokens. Triggers on: "compress context",
    "session too long", "summarize history", or at 80% token budget.
metadata:
    sources:
        - kind: github-file
          repo: NousResearch/hermes-agent
          path: trajectory_compressor.py
          attribution: NousResearch
          license: MIT
          usage: referenced
---

# Hermes Context Compressor

When an agent's context window is near full, this skill compresses the
**middle turns** of the session history into a concise `[CONTEXT SUMMARY]`,
while protecting the critical head and tail turns.

---

## When to Trigger

Trigger this skill when ANY of these conditions are true:

- Estimated token count exceeds **80% of the model's context window**
- CFO/VP-Engineering flags a session above the cost threshold
- Agent receives a `budget_alert` from the Orchestrator
- A session has been running for more than **4 heartbeat cycles** without completion

---

## Compression Algorithm (from trajectory_compressor.py)

```
PROTECT:
  - First system prompt turn          (ALWAYS protected)
  - First user message turn           (ALWAYS protected)
  - First assistant response turn     (ALWAYS protected)
  - First tool call turn              (ALWAYS protected)
  - Last 4 turns                      (ALWAYS protected)

COMPRESS:
  - Everything in between (the "compressible middle region")
  - Start from the earliest compressible turn
  - Accumulate until token savings target is met
  - Replace accumulated turns with ONE [CONTEXT SUMMARY] block

TARGET:
  - target_max_tokens: 15,250
  - summary_target_tokens: 750
  - tokens_to_save = total_tokens - target_max_tokens
  - compress_until = first N turns where Σtokens ≥ tokens_to_save + 750
```

---

## Step-by-Step Procedure

### Step 1: Assess Token Usage

Before compressing, estimate the current token count:

```
token_estimate = Σ(len(message.content) / 4) for all messages in session
```

If `token_estimate < 12,000`: do NOT compress — return immediately.

### Step 2: Identify Protected Turns

Mark as PROTECTED (never compress):

- Turn index 0 (system prompt — Lole COL context)
- Turn index 1 (first human message — the original task)
- Turn index 2 (first assistant response)
- Turn index 3 (first tool call/result)
- Last 4 turns (the most recent work — always preserved)

### Step 3: Extract Middle Region for Summarization

Collect all turns between the protected head and protected tail.
Format them as:

```
[Turn {i} - {ROLE}]:
{content}
```

Truncate individual turn content to 3,000 chars max (1,500 head + 500 tail)
if it exceeds that length.

### Step 4: Generate Summary

Call the summarizer with this prompt:

```
Summarize the following agent conversation turns concisely.
This summary will replace these turns in the conversation history.

Write from a neutral perspective describing what the assistant did and learned. Include:
1. What actions the agent took (tool calls, searches, file operations)
2. Key information or results obtained
3. Any important decisions or findings
4. Relevant data, file names, values, or outputs

Keep the summary factual and informative. Target approximately 750 tokens.

---
TURNS TO SUMMARIZE:
{extracted_content}
---

Write only the summary, starting with "[CONTEXT SUMMARY]:" prefix.
```

**Retry policy:** max 3 attempts, with jittered backoff (2s base, 30s max).
**Fallback:** if all retries fail, use:
`[CONTEXT SUMMARY]: Previous turns compressed — agent was working on {task_title}.`

### Step 5: Reconstruct Session

```
new_session = [
  ...protected_head_turns,
  { role: "user", content: "[CONTEXT SUMMARY]: {summary}" },
  ...protected_tail_turns
]
```

Record the original session as the `parent_session_id` of the new compressed
session in the persistent memory store.

### Step 6: Write Compression Metrics

Append to `.col/memory/episodes/compression-log.md`:

```
| {timestamp} | {agent} | {original_tokens} | {compressed_tokens} | {ratio} |
```

---

## Compression Metrics (track these)

| Metric              | Description                            |
| ------------------- | -------------------------------------- |
| `original_tokens`   | Token count before compression         |
| `compressed_tokens` | Token count after compression          |
| `tokens_saved`      | Difference                             |
| `compression_ratio` | `compressed / original`                |
| `turns_removed`     | Number of turns replaced by summary    |
| `was_compressed`    | Boolean — did compression occur        |
| `still_over_limit`  | If still over budget after compression |

---

## COL-Specific Rules

1. **CEO and CTO sessions**: Never compress without explicit board approval.
   Their full context is always preserved as-is.
2. **Compliance sessions**: Never compress turns containing ERCA/MoR API
   responses — those are audit-critical and must remain verbatim.
3. **After compression**: always write the compressed session summary to
   `.col/memory/sessions/` via `hermes-persistent-memory`.

---

## Source Reference

Adapted from `trajectory_compressor.py` in [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) (MIT License).
