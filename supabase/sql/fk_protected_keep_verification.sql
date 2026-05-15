-- Stage 1 runbook query:
-- Identify zero-scan, non-unique indexes that are FK-covering and have no alternate
-- non-partial FK-leading index on the same table.

with idx as (
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
    ns.nspname, t.relname, i.relname, i.oid, x.indrelid, s.idx_scan,
    x.indisunique, x.indisprimary, x.indisvalid, x.indisready, x.indpred
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
    idx.table_name,
    idx.index_name,
    idx.idx_scan,
    idx.index_columns,
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
    ) as fk_has_alt_non_partial,
    idx.indisunique,
    idx.indisprimary
  from idx
)
select table_name, index_name
from classified
where not indisprimary
  and not indisunique
  and idx_scan = 0
  and is_fk_covering
  and not fk_has_alt_non_partial
order by table_name, index_name;
