-- Purpose:
-- Reusable classification query for advisor-driven index cleanup.
-- It separates indexes into:
--   - safe_to_drop
--   - must_keep_fk_only_covering
--   - must_keep_hot_table
--   - must_keep_constraint_backing
--   - must_keep_used
--
-- Usage:
-- 1) Run this file before each cleanup stage.
-- 2) For batch drops, use only rows with classification = 'safe_to_drop'.
-- 3) Re-run after each stage and verify no FK regressions.

with hot_tables as (
  -- Edit this list as your hot-path policy evolves.
  select unnest(array[
    'orders',
    'order_items',
    'order_events',
    'kds_order_items',
    'kds_item_events',
    'table_sessions',
    'tables',
    'payments',
    'refunds',
    'payouts',
    'reconciliation_entries',
    'menu_items',
    'categories',
    'service_requests',
    'restaurants'
  ]) as table_name
),
idx as (
  select
    ns.nspname as schema_name,
    t.relname as table_name,
    i.relname as index_name,
    i.oid as index_oid,
    x.indrelid as table_oid,
    coalesce(s.idx_scan, 0) as idx_scan,
    x.indisunique,
    x.indisprimary,
    x.indisvalid,
    x.indisready,
    (x.indpred is not null) as is_partial,
    pg_get_indexdef(i.oid) as index_def,
    array_remove(array_agg(att.attname order by ord.n), null) as index_columns
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
    ns.nspname,
    t.relname,
    i.relname,
    i.oid,
    x.indrelid,
    s.idx_scan,
    x.indisunique,
    x.indisprimary,
    x.indisvalid,
    x.indisready,
    x.indpred
),
fk as (
  select
    c.conrelid as table_oid,
    c.conname as fk_name,
    array_agg(att.attname order by u.ord) as fk_columns
  from pg_constraint c
  join lateral unnest(c.conkey) with ordinality as u(attnum, ord) on true
  join pg_attribute att on att.attrelid = c.conrelid and att.attnum = u.attnum
  where c.contype = 'f'
  group by c.conrelid, c.conname
),
classified as (
  select
    idx.schema_name,
    idx.table_name,
    idx.index_name,
    idx.index_columns,
    idx.idx_scan,
    idx.indisunique,
    idx.indisprimary,
    idx.indisvalid,
    idx.indisready,
    idx.is_partial,
    idx.index_def,
    exists (
      select 1
      from hot_tables h
      where h.table_name = idx.table_name
    ) as is_hot_table,
    exists (
      select 1
      from fk
      where fk.table_oid = idx.table_oid
        and idx.index_columns[1:cardinality(fk.fk_columns)] = fk.fk_columns
    ) as is_fk_covering,
    exists (
      select 1
      from fk
      where fk.table_oid = idx.table_oid
        and idx.index_columns[1:cardinality(fk.fk_columns)] = fk.fk_columns
        and exists (
          select 1
          from idx alt
          where alt.table_oid = idx.table_oid
            and alt.index_oid <> idx.index_oid
            and alt.indisvalid
            and alt.indisready
            and not alt.is_partial
            and alt.index_columns[1:cardinality(fk.fk_columns)] = fk.fk_columns
        )
    ) as fk_has_alt_non_partial
  from idx
)
select
  schema_name,
  table_name,
  index_name,
  index_columns,
  idx_scan,
  case
    when indisprimary or indisunique then 'must_keep_constraint_backing'
    when is_hot_table then 'must_keep_hot_table'
    when is_fk_covering and not fk_has_alt_non_partial then 'must_keep_fk_only_covering'
    when idx_scan > 0 then 'must_keep_used'
    else 'safe_to_drop'
  end as classification,
  index_def
from classified
where not indisprimary
  and not indisunique
order by
  classification,
  table_name,
  index_name;
