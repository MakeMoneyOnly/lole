-- Stage 5 Evidence Window - Step 01
-- Purpose:
--   Capture point-in-time snapshots for:
--   - index usage (pg_stat_user_indexes + pg_index metadata)
--   - query stats (extensions.pg_stat_statements)
--
-- Run on a fixed cadence during the 2-4 week window (e.g., daily at same time).

with snapshot_ts as (
  select now() as ts
),
idx as (
  select
    ns.nspname as schema_name,
    t.relname as table_name,
    i.relname as index_name,
    i.oid as index_oid,
    coalesce(s.idx_scan, 0) as idx_scan,
    coalesce(s.idx_tup_read, 0) as idx_tup_read,
    coalesce(s.idx_tup_fetch, 0) as idx_tup_fetch,
    x.indisunique as is_unique,
    x.indisprimary as is_primary,
    (x.indpred is not null) as is_partial,
    x.indisvalid as is_valid,
    x.indisready as is_ready,
    array_remove(array_agg(att.attname order by ord.n), null) as index_columns,
    pg_get_indexdef(i.oid) as index_def
  from pg_index x
  join pg_class i on i.oid = x.indexrelid
  join pg_class t on t.oid = x.indrelid
  join pg_namespace ns on ns.oid = t.relnamespace
  left join pg_stat_user_indexes s on s.indexrelid = i.oid
  left join lateral unnest(x.indkey::int2[]) with ordinality as ord(attnum, n) on true
  left join pg_attribute att on att.attrelid = t.oid and att.attnum = ord.attnum
  where ns.nspname = 'public'
    and t.relkind = 'r'
  group by
    ns.nspname, t.relname, i.relname, i.oid, s.idx_scan, s.idx_tup_read, s.idx_tup_fetch,
    x.indisunique, x.indisprimary, x.indpred, x.indisvalid, x.indisready
)
insert into ops.stage5_index_usage_snapshots (
  captured_at,
  schema_name,
  table_name,
  index_name,
  index_oid,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  is_unique,
  is_primary,
  is_partial,
  is_valid,
  is_ready,
  index_columns,
  index_def
)
select
  st.ts,
  idx.schema_name,
  idx.table_name,
  idx.index_name,
  idx.index_oid,
  idx.idx_scan,
  idx.idx_tup_read,
  idx.idx_tup_fetch,
  idx.is_unique,
  idx.is_primary,
  idx.is_partial,
  idx.is_valid,
  idx.is_ready,
  idx.index_columns,
  idx.index_def
from idx
cross join snapshot_ts st;

with snapshot_ts as (
  select now() as ts
)
insert into ops.stage5_query_stat_snapshots (
  captured_at,
  dbid,
  userid,
  queryid,
  calls,
  total_exec_time_ms,
  mean_exec_time_ms,
  rows,
  shared_blks_hit,
  shared_blks_read,
  wal_bytes,
  scope,
  query_text
)
select
  st.ts as captured_at,
  pss.dbid,
  pss.userid,
  pss.queryid,
  pss.calls,
  pss.total_exec_time,
  pss.mean_exec_time,
  pss.rows,
  pss.shared_blks_hit,
  pss.shared_blks_read,
  pss.wal_bytes,
  case
    when pss.query ilike '%orders%' then 'orders'
    when pss.query ilike '%table_sessions%' then 'table_sessions'
    when pss.query ilike '%kds_order_items%' or pss.query ilike '%kds_item_events%' then 'kds'
    when pss.query ilike '%payments%' or pss.query ilike '%refunds%' or pss.query ilike '%payouts%' then 'payments'
    when pss.query ilike '%merchant/command-center%' then 'command_center'
    else 'other'
  end as scope,
  left(pss.query, 4000) as query_text
from extensions.pg_stat_statements pss
cross join snapshot_ts st
where pss.query not ilike '%pg_stat_statements%'
  and pss.calls > 0;

insert into ops.stage5_run_events(event_type, details)
values (
  'stage5_snapshot_captured',
  jsonb_build_object(
    'captured_at', now(),
    'note', 'index and query snapshots inserted'
  )
);
