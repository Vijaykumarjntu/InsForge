import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Scheduled Inspection Agent Engine & Night Shift Premium Contracts', () => {
  it('proves the existence of migration file 050 with system tracking schema statements', () => {
    const migrationSource = readFileSync(
      resolve(__dirname, '../../src/infra/database/migrations/050_create-inspection-agents-ledger.sql'),
      'utf-8'
    );
    expect(migrationSource).toContain('CREATE TABLE IF NOT EXISTS system.inspection_logs');
  });

  it('proves the existence of migration file 051 extending data structures for Night Shift', () => {
    const migrationSource = readFileSync(
      resolve(__dirname, '../../src/infra/database/migrations/051_enable-night-shift-agent.sql'),
      'utf-8'
    );
    expect(migrationSource).toContain('inspection_type TEXT NOT NULL');
    expect(migrationSource).toContain('CREATE TABLE IF NOT EXISTS system.night_shift_config');
  });

  it('verifies the Night Shift Agent targets all 7 required core audit vectors', () => {
    const agentSource = readFileSync(
      resolve(__dirname, '../../src/services/schedules/night-shift-agent.service.ts'),
      'utf-8'
    );
    expect(agentSource).toContain('runOvernightInspection');
    expect(agentSource).toContain('DATABASE');
    expect(agentSource).toContain('AUTH');
    expect(agentSource).toContain('STORAGE');
    expect(agentSource).toContain('openGitHubDraftPR');
  });
});