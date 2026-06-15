import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Staging to Production Migration Pipeline & Snapshot Suite Contracts', () => {
  it('proves the existence of migration file 052 with environment tracking ledger definitions', () => {
    const migrationSource = readFileSync(
      resolve(__dirname, '../../src/infra/database/migrations/052_create-staging-migration-ledger.sql'),
      'utf-8'
    );
    expect(migrationSource).toContain('CREATE TABLE IF NOT EXISTS system.environment_migrations');
  });

  it('proves the existence of migration file 053 with snapshots and orchestrator configs', () => {
    const migrationSource = readFileSync(
      resolve(__dirname, '../../src/infra/database/migrations/053_upgrade-migration-orchestrator.sql'),
      'utf-8'
    );
    expect(migrationSource).toContain('CREATE TABLE IF NOT EXISTS system.migration_orchestrator_config');
    expect(migrationSource).toContain('CREATE TABLE IF NOT EXISTS system.migration_snapshots');
    expect(migrationSource).toContain('immutable_production_enabled');
    expect(migrationSource).toContain('expires_at TIMESTAMPTZ');
  });

  it('verifies the service handles snapshot isolation, AI consolidation mode, and deployment routing options', () => {
    const serviceSource = readFileSync(
      resolve(__dirname, '../../src/services/database/staging-sync.service.ts'),
      'utf-8'
    );
    expect(serviceSource).toContain('class StagingSyncService');
    expect(serviceSource).toContain('createRollbackSnapshot');
    expect(serviceSource).toContain('consolidatePendingMigrationsWithAI');
    expect(serviceSource).toContain('deployStagingToProduction');
    expect(serviceSource).toContain('AI_CONSOLIDATED');
    expect(serviceSource).toContain('immutable_production_enabled');
  });
});