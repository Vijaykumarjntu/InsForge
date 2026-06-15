import { AppError } from '@/utils/errors.js';
import { ERROR_CODES } from '@insforge/shared-schemas';
import { validateIdentifier, validateSchemaName, validateTableName } from '@/utils/validations.js';
import { EncryptionManager } from '@/infra/security/encryption.manager.js';

export const DEFAULT_DATABASE_SCHEMA = 'public' as const;

export function isInternalDashboardSchema(schemaName: string): boolean {
  return schemaName === 'information_schema' || schemaName.startsWith('pg_');
}

export function normalizeDatabaseSchemaName(schemaName: unknown): string {
  if (typeof schemaName !== 'string' || schemaName.trim().length === 0) {
    return DEFAULT_DATABASE_SCHEMA;
  }

  const normalizedSchemaName = schemaName.trim();
  validateSchemaName(normalizedSchemaName);

  if (isInternalDashboardSchema(normalizedSchemaName)) {
    throw new AppError(
      `Schema "${normalizedSchemaName}" is not available in the dashboard.`,
      400,
      ERROR_CODES.INVALID_INPUT,
      'Internal PostgreSQL and platform schemas cannot be queried from the dashboard.'
    );
  }

  return normalizedSchemaName;
}

export function buildQualifiedTableKey(tableName: string, schemaName: string): string {
  return `${schemaName}.${tableName}`;
}

export function quoteIdentifier(identifier: string): string {
  validateIdentifier(identifier);
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function quoteQualifiedName(schemaName: string, objectName: string): string {
  validateSchemaName(schemaName);
  validateIdentifier(objectName);
  return `${quoteIdentifier(schemaName)}.${quoteIdentifier(objectName)}`;
}

export function splitQualifiedTableReference(
  tableReference: string,
  defaultSchemaName: string = DEFAULT_DATABASE_SCHEMA
): { schemaName: string; tableName: string } {
  const parts = tableReference.split('.');

  if (parts.length === 1) {
    validateTableName(parts[0]);
    return {
      schemaName: defaultSchemaName,
      tableName: parts[0],
    };
  }

  if (parts.length !== 2) {
    throw new AppError(
      `Invalid table reference "${tableReference}"`,
      400,
      ERROR_CODES.INVALID_INPUT,
      'Use either "table" or "schema.table" when referencing a table.'
    );
  }

  const [schemaName, tableName] = parts;
  validateSchemaName(schemaName);
  validateTableName(tableName);

  return {
    schemaName,
    tableName,
  };
}


/**
 * Global Column-Level Encryption Registry
 * Maps fully qualified table names or specific columns to automatic cryptographic handling.
 */
export const ENCRYPTED_COLUMNS_REGISTRY = new Set<string>([
  'public.users.ssn',
  'public.users.tax_id',
  'public.projects.api_key',
  'public.projects.secret_token'
]);

/**
 * Transparently encrypts registered sensitive fields within an outbound payload object.
 */
export function encryptRecordFields(schemaName: string, tableName: string, payload: Record<string, any>): Record<string, any> {
  if (!payload || typeof payload !== 'object') return payload;
  
  const encryptedPayload = { ...payload };
  const targetSchema = schemaName || DEFAULT_DATABASE_SCHEMA;

  for (const key of Object.keys(encryptedPayload)) {
    const qualifiedColumnPath = `${targetSchema}.${tableName}.${key}`;
    
    if (ENCRYPTED_COLUMNS_REGISTRY.has(qualifiedColumnPath)) {
      const plainValue = encryptedPayload[key];
      
      // Ensure we only process non-null, defined string expressions
      if (typeof plainValue === 'string' && plainValue.trim().length > 0) {
        encryptedPayload[key] = EncryptionManager.encrypt(plainValue);
      }
    }
  }

  return encryptedPayload;
}

/**
 * Safely decodes any detected encrypted string tokens inside an inbound database record.
 */
export function decryptRecordFields(record: Record<string, any>): Record<string, any> {
  if (!record || typeof record !== 'object') return record;

  const decryptedRecord = { ...record };

  for (const key of Object.keys(decryptedRecord)) {
    const mixedValue = decryptedRecord[key];

    // Detect our EncryptionManager's distinct structural footprint (iv:authTag:ciphertext)
    if (typeof mixedValue === 'string' && mixedValue.split(':').length === 3) {
      try {
        decryptedRecord[key] = EncryptionManager.decrypt(mixedValue);
      } catch {
        // Fall back gracefully to the original string value if it's not a true crypt token
      }
    }
  }

  return decryptedRecord;
}