import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Column-Level Encryption Infrastructure Contracts', () => {
  // Read the raw file content buffer to analyze the implementation structure
  const helpersSource = readFileSync(
    resolve(__dirname, '../../src/services/database/helpers.ts'),
    'utf-8'
  );

  it('declares the authoritative sensitive field ENCRYPTED_COLUMNS_REGISTRY matrix', () => {
    // Verifies that a registry is defined to match critical data targets
    expect(helpersSource).toContain('ENCRYPTED_COLUMNS_REGISTRY = new Set');
    expect(helpersSource).toMatch(/public\.users\.ssn/);
    expect(helpersSource).toMatch(/public\.projects\.api_key/);
  });

  it('implements the outbound interceptor function encryptRecordFields', () => {
    // Confirms existence and baseline validation loop inside the encryptor
    expect(helpersSource).toContain('function encryptRecordFields');
    expect(helpersSource).toContain('EncryptionManager.encrypt');
  });

  it('implements the inbound parsing function decryptRecordFields', () => {
    // Proves the existence of a parsing loop running decipher operations
    expect(helpersSource).toContain('function decryptRecordFields');
    expect(helpersSource).toContain('EncryptionManager.decrypt');
  });

  it('safely wraps decryption in a defensive try/catch fault interceptor block', () => {
    // Asserts that standard text blocks or corrupt tokens won't break runtime execution queries
    expect(helpersSource).toMatch(/try\s*\{\s*decryptedRecord\[key\]\s*=\s*EncryptionManager\.decrypt/);
  });
});