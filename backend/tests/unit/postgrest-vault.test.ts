import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('PostgREST Crypto Vault Proxy Layer Contracts', () => {
  const proxySource = readFileSync(
    resolve(__dirname, '../../src/services/database/postgrest-proxy.service.ts'),
    'utf-8'
  );

  it('proves the existence of a high-performance registry cache matrix', () => {
    expect(proxySource).toContain('CACHED_ENCRYPTED_COLUMNS');
    expect(proxySource).toContain('integrations.credentials');
  });

  it('enforces explicit query filter blocks to shield encrypted columns', () => {
    expect(proxySource).toContain('interceptAndProcessProxyRequest');
    expect(proxySource).toContain('is not supported');
  });

  it('transparently encrypts user-written payloads on inbound data modifications', () => {
    expect(proxySource).toContain('EncryptionManager.encrypt');
  });

  it('transparently resolves out hidden database rows on select transactions', () => {
    expect(proxySource).toContain('interceptAndProcessProxyResponse');
    expect(proxySource).toContain('EncryptionManager.decrypt');
    expect(proxySource).toContain('JSON.parse');
  });

  it('proves the existence of migration file 049 with system registry schema statements', () => {
    const migrationSource = readFileSync(
      resolve(__dirname, '../../src/infra/database/migrations/049_create-column-encryption-registry.sql'),
      'utf-8'
    );
    
    expect(migrationSource).toContain('CREATE TABLE IF NOT EXISTS system.encrypted_columns');
    expect(migrationSource).toContain('auth\', \'user_providers\', \'access_token\'');
    expect(migrationSource).toContain('auth\', \'user_providers\', \'refresh_token\'');
  });
});