-- Stage 5 Evidence Window - Step 00
-- Purpose:
--   1) Create durable snapshot tables for index/query evidence collection
--   2) Reset stats at the start of the 2-4 week measurement window
--
-- Run once at the start of the measurement window.

create schema if not exists ops;

create table if not exists ops.stage5_run_events (
  id bigserial primary key,
  event_at timestamptz not null default now(),
  event_type text not null,
  details jsonb
);

create table if not exists ops.stage5_index_usage_snapshots (
  id bigserial primary key,
  captured_at timestamptz not null,
  schema_name text not null,
  table_name text not null,
  index_name text not null,
  index_oid oid not null,
  idx_scan bigint not null,
  idx_tup_read bigint not null,
  idx_tup_fetch bigint not null,
  is_unique boolean not null,
  is_primary boolean not null,
  is_partial boolean not null,
  is_valid boolean not null,
  is_ready boolean not null,
  index_columns text[],
  index_def text not null
);

create index if not exists idx_stage5_index_usage_snapshots_captured_at
  on ops.stage5_index_usage_snapshots(captured_at desc);

create index if not exists idx_stage5_index_usage_snapshots_index
  on ops.stage5_index_usage_snapshots(schema_name, table_name, index_name, captured_at desc);

create table if not exists ops.stage5_query_stat_snapshots (
  id bigserial primary key,
  captured_at timestamptz not null,
  dbid oid not null,
  userid oid not null,
  queryid bigint,
  calls bigint not null,
  total_exec_time_ms double precision not null,
  mean_exec_time_ms double precision not null,
  rows bigint not null,
  shared_blks_hit bigint not null,
  shared_blks_read bigint not null,
  wal_bytes numeric not null,
  scope text not null,
  query_text text not null
);

create index if not exists idx_stage5_query_stat_snapshots_captured_at
  on ops.stage5_query_stat_snapshots(captured_at desc);

create index if not exists idx_stage5_query_stat_snapshots_queryid
  on ops.stage5_query_stat_snapshots(queryid, captured_at desc);

do $$
begin
  -- Reset generic stats counters for a clean evidence window baseline.
  begin
    perform pg_catalog.pg_stat_reset();
    insert into ops.stage5_run_events(event_type, details)
    values ('pg_stat_reset_success', jsonb_build_object('at', now()));
  exception
    when insufficient_privilege then
      insert into ops.stage5_run_events(event_type, details)
      values ('pg_stat_reset_skipped', jsonb_build_object('reason', 'insufficient_privilege', 'at', now()));
  end;

  -- Reset pg_stat_statements counters.
  begin
    perform extensions.pg_stat_statements_reset();
    insert into ops.stage5_run_events(event_type, details)
    values ('pg_stat_statements_reset_success', jsonb_build_object('at', now()));
  exception
    when insufficient_privilege then
      insert into ops.stage5_run_events(event_type, details)
      values ('pg_stat_statements_reset_skipped', jsonb_build_object('reason', 'insufficient_privilege', 'at', now()));
    when undefined_function then
      insert into ops.stage5_run_events(event_type, details)
      values ('pg_stat_statements_reset_skipped', jsonb_build_object('reason', 'undefined_function', 'at', now()));
  end;

  insert into ops.stage5_run_events(event_type, details)
  values (
    'stage5_window_initialized',
    jsonb_build_object(
      'window_target', '2-4 weeks',
      'started_at', now()
    )
  );
end
$$;
