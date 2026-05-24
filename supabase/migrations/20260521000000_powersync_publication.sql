-- Migration: Create PowerSync Publication
-- Date: 2026-05-21
-- Description: Creates a publication for logical replication with PowerSync.
--              This publication includes all tables for real-time sync capabilities.

BEGIN;

-- Create publication for PowerSync logical replication
-- FOR ALL TABLES includes all current and future tables
-- WITH (publish = 'insert, update, delete') enables DML replication
CREATE PUBLICATION powersync FOR ALL TABLES;

COMMIT;