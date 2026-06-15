-- Migration: 050_create-inspection-agents-ledger.sql
-- Description: Provision the automated health inspection historical data ledger

CREATE TABLE IF NOT EXISTS system.inspection_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name TEXT NOT NULL DEFAULT 'daily_advisor_agent',
    health_score INT NOT NULL CHECK (health_score >= 0 AND health_score <= 100),
    tables_scanned INT NOT NULL DEFAULT 0,
    unindexed_columns_count INT NOT NULL DEFAULT 0,
    security_vulnerabilities_count INT NOT NULL DEFAULT 0,
    scan_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Establish proper administrative privileges matching your cluster guidelines
ALTER TABLE system.inspection_logs OWNER TO project_admin;
GRANT ALL PRIVILEGES ON TABLE system.inspection_logs TO project_admin;

CREATE INDEX IF NOT EXISTS idx_inspection_logs_created_at ON system.inspection_logs (created_at DESC);

COMMENT ON TABLE system.inspection_logs IS 'Historical telemetry logs capturing automated system-wide daily database health advisor performance checks.';