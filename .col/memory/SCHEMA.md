# LLM Wiki Schema (Lole COL)

This is the Schema definition for the LLM Wiki serving as the memory architecture for the Cognitive Orchestration Layer (COL). It defines how the agent maintains the wiki as a structured, interlinked collection of markdown files.

## Architecture

1. **Raw sources (`.col/memory/raw/`)**: Immutable source documents. The LLM reads from these but never modifies them. They act as the source of truth.
2. **The wiki (`.col/memory/wiki/`)**: A directory of LLM-generated markdown files (Summaries, entity pages, concept pages). The LLM owns this layer entirely. It creates pages, updates them when new sources arrive, maintains cross-references, and keeps everything consistent.
3. **The schema (`.col/memory/SCHEMA.md`)**: This document. It tells the LLM how the wiki is structured, the conventions, and the workflows.

## Operations

1. **Ingest**: When processing a new source from `raw/` or from codebase changes:
    - Read the source.
    - Write a summary page in `wiki/sources/`.
    - Update `wiki/index.md`.
    - Update relevant entity (`wiki/entities/`) and concept (`wiki/concepts/`) pages across the wiki.
    - Note where new data contradicts old claims and flag it.
    - Append an entry to `wiki/log.md`.
2. **Query**: When answering questions:
    - Search for relevant pages starting with `index.md`.
    - Read them and synthesize an answer with citations.
    - If the answer provides valuable connections or comparisons, file it back into `wiki/synthesis/` as a new page.
3. **Lint**: Periodically health-check the wiki:
    - Find contradictions between pages.
    - Identify stale claims that newer sources have superseded.
    - Flag orphan pages with no inbound links.
    - Check for important concepts mentioned but lacking their own page.
    - Ensure all missing cross-references are fixed.

## Conventions

- Use standard Markdown formatting.
- Include YAML frontmatter for metadata (e.g., `title`, `tags`, `last_updated`, `source_count`).
- Use standard wikilinks format for cross-referencing: `[[Page Name]]`.

## Logging and Indexing

- **`index.md`**: A catalog of everything in the wiki organized by category. Each page listed with a link, a one-line summary, and metadata. Updated on every ingest.
- **`log.md`**: Chronological, append-only record of what happened (ingests, queries, lint passes). Format entries like: `## [YYYY-MM-DD HH:MM] ingest | Source Title`.
