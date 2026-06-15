-- Migration: 051_enable-night-shift-agent.sql
-- Description: Expand metadata ledger to track premium Night Shift flags and PR linkage

ALTER TABLE system.inspection_logs 
ADD COLUMN IF NOT EXISTS inspection_type TEXT NOT NULL DEFAULT 'TELEMETRY' CHECK (inspection_type IN ('TELEMETRY', 'NIGHT_SHIFT')),
ADD COLUMN IF NOT EXISTS target_domain TEXT NOT NULL DEFAULT 'DATABASE',
ADD COLUMN IF NOT EXISTS pull_request_url TEXT,
ADD COLUMN IF NOT EXISTS remediation_status TEXT NOT NULL DEFAULT 'NONE' CHECK (remediation_status IN ('NONE', 'PR_OPENED', 'SILENT_PASS', 'FAILED'));

-- Add a global configuration table to control Night Shift switches project-wide
CREATE TABLE IF NOT EXISTS system.night_shift_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enabled BOOLEAN NOT NULL DEFAULT false,
    github_repository TEXT, -- Format: 'owner/repo'
    github_installation_id TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE system.night_shift_config OWNER TO project_admin;
GRANT ALL PRIVILEGES ON TABLE system.night_shift_config TO project_admin;