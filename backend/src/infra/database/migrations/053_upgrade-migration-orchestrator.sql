-- Migration: 053_upgrade-migration-orchestrator.sql
-- Description: Provision schema properties for AI consolidation, environment snapshots, and immutability flags

CREATE TABLE IF NOT EXISTS system.migration_orchestrator_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    immutable_production_enabled BOOLEAN NOT NULL DEFAULT false,
    snapshot_ttl_hours INT NOT NULL DEFAULT 24,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system.migration_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_schema_name TEXT NOT NULL,
    source_environment TEXT NOT NULL DEFAULT 'PRODUCTION',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed defaults for immediate operational support
INSERT INTO system.migration_orchestrator_config (immutable_production_enabled, snapshot_ttl_hours)
VALUES (false, 24) ON CONFLICT DO NOTHING;