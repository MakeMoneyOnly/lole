-- Stage 5 Evidence Window - Step 02
-- Purpose:
--   Analyze snapshots after 2-4 weeks to support index keep/drop decisions.

-- A) Snapshot bounds
select
  min(captured_at) as window_start,
  max(captured_at) as window_end,
  count(distinct captured_at) as snapshots_captured
from ops.stage5_index_usage_snapshots;

-- B) Index usage growth between first and last snapshot
with bounds as (
  select min(captured_at) as start_ts, max(captured_at) as end_ts
  from ops.stage5_index_usage_snapshots
),
start_s as (
  select s.*
  from ops.stage5_index_usage_snapshots s
  join bounds b on s.captured_at = b.start_ts
),
end_s as (
  select s.*
  from ops.stage5_index_usage_snapshots s
  join bounds b on s.captured_at = b.end_ts
)
select
  e.schema_name,
  e.table_name,
  e.index_name,
  e.is_unique,
  e.is_primary,
  e.is_partial,
  e.idx_scan - coalesce(s.idx_scan, 0) as idx_scan_delta,
  e.idx_tup_read - coalesce(s.idx_tup_read, 0) as idx_tup_read_delta,
  e.idx_tup_fetch - coalesce(s.idx_tup_fetch, 0) as idx_tup_fetch_delta,
  e.index_def
from end_s e
left join start_s s
  on s.schema_name = e.schema_name
 and s.table_name = e.table_name
 and s.index_name = e.index_name
order by
  idx_scan_delta asc,
  e.table_name,
  e.index_name;

-- C) Candidate watch-list: non-unique indexes with no observed scans in window
with bounds as (
  select min(captured_at) as start_ts, max(captured_at) as end_ts
  from ops.stage5_index_usage_snapshots
),
start_s as (
  select s.*
  from ops.stage5_index_usage_snapshots s
  join bounds b on s.captured_at = b.start_ts
),
end_s as (
  select s.*
  from ops.stage5_index_usage_snapshots s
  join bounds b on s.captured_at = b.end_ts
)
select
  e.schema_name,
  e.table_name,
  e.index_name,
  e.is_partial,
  e.is_valid,
  e.is_ready,
  e.idx_scan - coalesce(s.idx_scan, 0) as idx_scan_delta,
  e.idx_tup_read - coalesce(s.idx_tup_read, 0) as idx_tup_read_delta,
  e.index_def
from end_s e
left join start_s s
  on s.schema_name = e.schema_name
 and s.table_name = e.table_name
 and s.index_name = e.index_name
where not e.is_unique
  and not e.is_primary
  and (e.idx_scan - coalesce(s.idx_scan, 0)) = 0
order by
  e.table_name,
  e.index_name;

-- D) Query performance growth between first and last snapshot
with bounds as (
  select min(captured_at) as start_ts, max(captured_at) as end_ts
  from ops.stage5_query_stat_snapshots
),
start_s as (
  select *
  from ops.stage5_query_stat_snapshots s
  join bounds b on s.captured_at = b.start_ts
),
end_s as (
  select *
  from ops.stage5_query_stat_snapshots s
  join bounds b on s.captured_at = b.end_ts
)
select
  e.scope,
  coalesce(e.queryid, -1) as queryid,
  left(e.query_text, 250) as sample_query,
  e.calls - coalesce(s.calls, 0) as calls_delta,
  e.total_exec_time_ms - coalesce(s.total_exec_time_ms, 0) as total_exec_time_ms_delta,
  case
    when (e.calls - coalesce(s.calls, 0)) > 0
      then round(((e.total_exec_time_ms - coalesce(s.total_exec_time_ms, 0)) / (e.calls - coalesce(s.calls, 0)))::numeric, 3)
    else null
  end as avg_exec_time_ms_over_window,
  e.shared_blks_read - coalesce(s.shared_blks_read, 0) as shared_blks_read_delta,
  e.wal_bytes - coalesce(s.wal_bytes, 0) as wal_bytes_delta
from end_s e
left join start_s s
  on s.dbid = e.dbid
 and s.userid = e.userid
 and s.queryid is not distinct from e.queryid
order by
  total_exec_time_ms_delta desc
limit 200;

-- E) Current top statements from pg_stat_statements (instantaneous view)
select
  pss.queryid,
  pss.calls,
  round(pss.total_exec_time::numeric, 2) as total_exec_time_ms,
  round(pss.mean_exec_time::numeric, 3) as mean_exec_time_ms,
  pss.rows,
  pss.shared_blks_read,
  pss.wal_bytes,
  left(pss.query, 250) as sample_query
from extensions.pg_stat_statements pss
where pss.query not ilike '%pg_stat_statements%'
order by pss.total_exec_time desc
limit 100;
