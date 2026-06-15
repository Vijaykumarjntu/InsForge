-- Migration: 052_create-staging-migration-ledger.sql
-- Description: Provision the staging-to-production tracking history ledger

CREATE TABLE IF NOT EXISTS system.environment_migrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_sequence INT NOT NULL,
    migration_name TEXT NOT NULL,
    sql_up TEXT NOT NULL,
    sql_down TEXT,
    checksum TEXT NOT NULL,
    environment TEXT NOT NULL DEFAULT 'PRODUCTION' CHECK (environment IN ('STAGING', 'PRODUCTION')),
    execution_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (execution_status IN ('PENDING', 'APPLIED', 'FAILED', 'ROLLED_BACK')),
    execution_duration_ms INT DEFAULT 0,
    error_message TEXT,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_env_sequence UNIQUE (environment, version_sequence)
);

ALTER TABLE system.environment_migrations OWNER TO project_admin;
GRANT ALL PRIVILEGES ON TABLE system.environment_migrations TO project_admin;

CREATE INDEX IF NOT EXISTS idx_env_migrations_status ON system.environment_migrations (environment, execution_status);