import { describe, test, expect } from 'vitest';
import { DatabaseAdvanceService } from '../../src/services/database/database-advance.service';
import { AppError } from '../../src/utils/errors';
import { ERROR_CODES } from '@insforge/shared-schemas';

describe('DatabaseAdvanceService - sanitizeQuery', () => {
  const service = DatabaseAdvanceService.getInstance();

  test('blocks database-level operations', () => {
    const queries = [
      'DROP DATABASE customer_project',
      'CREATE DATABASE customer_project',
      'ALTER DATABASE customer_project SET timezone TO UTC',
    ];

    for (const query of queries) {
      expect(() => service.sanitizeQuery(query)).toThrow(AppError);
    }
  });

  test('blocks role and session authorization management', () => {
    const queries = [
      'SET ROLE postgres',
      'SET LOCAL ROLE postgres',
      'RESET ROLE',
      'SET SESSION AUTHORIZATION postgres',
      'RESET SESSION AUTHORIZATION',
      'RESET ALL',
      'SET search_path TO public',
      "SELECT set_config('search_path', 'public', false)",
      'SET statement_timeout = 0',
      'RESET statement_timeout',
      'CREATE ROLE app_owner',
      'ALTER ROLE project_admin SET search_path TO public',
      'DROP ROLE app_owner',
      'GRANT postgres TO project_admin',
    ];

    for (const query of queries) {
      expect(() => service.sanitizeQuery(query)).toThrow(AppError);
    }
  });

  test('blocks transaction control in raw SQL', () => {
    const queries = ['BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT before_change'];

    for (const query of queries) {
      expect(() => service.sanitizeQuery(query)).toThrow(AppError);
    }
  });

  test('throws AppError with 403 FORBIDDEN for execution context violations', () => {
    try {
      service.sanitizeQuery('RESET ROLE');
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      if (error instanceof AppError) {
        expect(error.statusCode).toBe(403);
        expect(error.code).toBe(ERROR_CODES.FORBIDDEN);
        expect(error.message).toContain('execution role');
      }
    }
  });

  test('allows managed schema statements to be decided by project_admin database grants', () => {
    const queries = [
      "INSERT INTO auth.users (email, password_hash) VALUES ('demo@example.com', 'hash')",
      'CREATE TRIGGER user_profile_trigger AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_user_profile()',
      'SELECT * FROM pg_catalog.pg_class LIMIT 1',
      "INSERT INTO storage.objects (bucket_id, key, name) VALUES ('avatars', 'u1/a.png', 'a.png')",
      'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY',
      "UPDATE payments.customers SET email = 'new@example.com' WHERE id = 'cus_123'",
      "INSERT INTO system.custom_migrations (version, name, statements) VALUES ('1', 'manual', ARRAY['SELECT 1'])",
    ];

    for (const query of queries) {
      expect(() => service.sanitizeQuery(query)).not.toThrow();
    }
  });

  test('allows public schema DDL and grants', () => {
    const queries = [
      'CREATE TABLE public.products (id uuid PRIMARY KEY)',
      'ALTER TABLE public.products ENABLE ROW LEVEL SECURITY',
      'CREATE POLICY products_select ON public.products FOR SELECT TO authenticated USING (true)',
      'GRANT SELECT ON public.products TO authenticated',
      'DROP POLICY products_select ON public.products',
    ];

    for (const query of queries) {
      expect(() => service.sanitizeQuery(query)).not.toThrow();
    }
  });
});

describe('DatabaseAdvanceService - runAdvisorScan Integration Seeding', () => {
  const service = DatabaseAdvanceService.getInstance();

  test('triggers and captures the "rls-disabled" rule against a raw seeded table', async () => {
    // 1. Seed a temporary insecure table explicitly without RLS enabled
    await service.executeRawSQL('DROP TABLE IF EXISTS public.test_vulnerable_leak;');
    await service.executeRawSQL('CREATE TABLE public.test_vulnerable_leak (id uuid PRIMARY KEY, secret_data text);');

    try {
      // 2. Trigger the Advisor Scan execution pipeline
      const result = await service.runAdvisorScan();

      // 3. Assert that the rule-id engine successfully catches the vulnerability
      const rlsFinding = result.findings.find(f => f.ruleId === 'rls-disabled' && f.title.includes('test_vulnerable_leak'));
      expect(rlsFinding).toBeDefined();
      expect(rlsFinding?.category).toBe('security');
      expect(rlsFinding?.impact).toBe('CRITICAL');
      expect(rlsFinding?.resolution).toContain('ENABLE ROW LEVEL SECURITY');
    } finally {
      // Clean up after the integration test run
      await service.executeRawSQL('DROP TABLE IF EXISTS public.test_vulnerable_leak;');
    }
  });

  test('triggers and captures the "dangerous-function" rule against an exposed SECURITY DEFINER routine', async () => {
    // 1. Seed an insecure SECURITY DEFINER function
    await service.executeRawSQL('DROP FUNCTION IF EXISTS public.test_leaky_privileges();');
    await service.executeRawSQL(`
      CREATE OR REPLACE FUNCTION public.test_leaky_privileges()
      RETURNS void AS $$
      BEGIN
        PERFORM 1;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    try {
      // 2. Scan the active database catalog state
      const result = await service.runAdvisorScan();

      // 3. Assert that the dangerous routine was successfully flagged
      const funcFinding = result.findings.find(f => f.ruleId === 'dangerous-function' && f.title.includes('test_leaky_privileges'));
      expect(funcFinding).toBeDefined();
      expect(funcFinding?.category).toBe('security');
      expect(funcFinding?.impact).toBe('CRITICAL');
    } finally {
      // Clean up the routine tracking context
      await service.executeRawSQL('DROP FUNCTION IF EXISTS public.test_leaky_privileges();');
    }
  });

  test('triggers and captures the "missing-fk-index" rule when parsing unindexed relational references', async () => {
    // 1. Setup a standard parent-child relationship missing an explicit index on the foreign key column
    await service.executeRawSQL('DROP TABLE IF EXISTS public.test_child_logs;');
    await service.executeRawSQL('DROP TABLE IF EXISTS public.test_parent_users;');
    
    await service.executeRawSQL('CREATE TABLE public.test_parent_users (id int PRIMARY KEY);');
    await service.executeRawSQL(`
      CREATE TABLE public.test_child_logs (
        id int PRIMARY KEY, 
        user_id int REFERENCES public.test_parent_users(id)
      );
    `);

    try {
      // 2. Run the advisor scanner loop
      const result = await service.runAdvisorScan();

      // 3. Verify that the performance engine successfully recommends an index action
      const fkFinding = result.findings.find(f => f.ruleId === 'missing-fk-index' && f.title.includes('test_child_logs'));
      expect(fkFinding).toBeDefined();
      expect(fkFinding?.category).toBe('performance');
      expect(fkFinding?.resolution).toContain('CREATE INDEX');
    } finally {
      // Clean up structural states
      await service.executeRawSQL('DROP TABLE IF EXISTS public.test_child_logs;');
      await service.executeRawSQL('DROP TABLE IF EXISTS public.test_parent_users;');
    }
  });

  test('enforces the single-concurrency in-memory execution lock', async () => {
    // Fire off two scans simultaneously to verify that the atomic flag rejects overlapping requests
    const scanOnePromise = service.runAdvisorScan();
    
    await expect(service.runAdvisorScan()).rejects.toThrowError(/already in progress/);
    
    // Resolve the first scan cleanly so we don't leak unreleased pool clients
    await scanOnePromise;
  });
});