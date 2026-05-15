# Stage 5 Evidence Window SQL Bundle (2026-03-03)

## Purpose

Prepare reproducible, evidence-based measurement for FK-protected index decisions over a 2-4 week window.

## Files

- `supabase/sql/stage5_evidence_window_00_init_and_reset.sql`
- `supabase/sql/stage5_evidence_window_01_capture_snapshot.sql`
- `supabase/sql/stage5_evidence_window_02_analysis_queries.sql`

## Run Order

1. Run `00_init_and_reset.sql` once at window start.
2. Run `01_capture_snapshot.sql` on a fixed cadence (recommended daily).
3. After 2-4 weeks, run `02_analysis_queries.sql`.

## Cadence Recommendation

- Minimum: 1 snapshot/day for 14 days.
- Preferred: 1 snapshot/day for 28 days.
- Keep capture time consistent (for example, 07:00 UTC daily).

## Evidence Gate for Index Changes

Before dropping any FK-protected index, require:

- Snapshot history present across the full window.
- Zero or near-zero usage deltas with documented rationale.
- Alternate non-partial FK-leading index in same migration stage.
- `EXPLAIN ANALYZE` before/after on affected hot queries.
- Rollback SQL prepared in the same stage.

## Notes

- `pg_stat_statements` is available in this project under `extensions.pg_stat_statements`.
- Reset steps are wrapped with privilege-safe logging in `ops.stage5_run_events`.
- This bundle is measurement-only and does not directly drop or alter indexes.

## Automation (Implemented)

- Daily snapshot workflow:
    - `.github/workflows/stage5-daily-snapshot.yml`
    - Trigger: daily cron (`05:15 UTC`) + manual dispatch
    - Action: runs `supabase/sql/stage5_evidence_window_01_capture_snapshot.sql`
- End-window analysis workflow:
    - `.github/workflows/stage5-end-window-analysis.yml`
    - Trigger: weekly cron (`Sunday 06:00 UTC`) + manual dispatch
    - Guard: skips automatically until at least `14` distinct snapshot days exist (unless `force_run=true`)
    - Action: runs `supabase/sql/stage5_evidence_window_02_analysis_queries.sql` and uploads artifact

## Required GitHub Secret

- `SUPABASE_DB_URL`
    - Postgres connection string for the target Supabase project.
    - Add in repository settings: `Settings -> Secrets and variables -> Actions`.
