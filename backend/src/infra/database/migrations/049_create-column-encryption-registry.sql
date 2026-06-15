-- Migration: 049_create-column-encryption-registry.sql
-- Description: Provision the application-level cryptographic vault tracking registry

CREATE TABLE IF NOT EXISTS system.encrypted_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schema_name TEXT NOT NULL DEFAULT 'public',
    table_name TEXT NOT NULL,
    column_name TEXT NOT NULL,
    key_version TEXT NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_schema_table_column UNIQUE (schema_name, table_name, column_name)
);

-- Assign administration access privileges to the platform project admin roles
ALTER TABLE system.encrypted_columns OWNER TO project_admin;
GRANT ALL PRIVILEGES ON TABLE system.encrypted_columns TO project_admin;

-- Seed baseline first-party dogfooding rows for standard third-party OAuth access fields
INSERT INTO system.encrypted_columns (schema_name, table_name, column_name, key_version)
VALUES 
    ('auth', 'user_providers', 'access_token', 'v1'),
    ('auth', 'user_providers', 'refresh_token', 'v1')
ON CONFLICT (schema_name, table_name, column_name) DO NOTHING;

COMMENT ON TABLE system.encrypted_columns IS 'Authoritative application-level tracking manifest for transparent AES-256-GCM column field vault layouts.';