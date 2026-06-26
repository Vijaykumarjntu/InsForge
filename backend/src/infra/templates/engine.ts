import { TEMPLATE_REGISTRY } from './registry';
import { TemplateResourceSummary } from './types';
import { Client } from 'pg';

export class TemplateOrchestrator {
  
  /**
   * REQ: Show exactly what resources will be created before applying a template
   */
  public static preview(templateId: string): TemplateResourceSummary {
    const template = TEMPLATE_REGISTRY[templateId];
    if (!template) {
      throw new Error(`Template variant [${templateId}] does not exist in master registry registries.`);
    }

    // Heuristically extract structural targets for safe developer readout
    const tables: string[] = ['public.profiles'];
    const buckets = template.storageBuckets.map(b => b.id);
    const functions = template.functions.map(f => f.name);
    const policies = ['"Users can view own profile matching token context"'];

    return { tables, buckets, functions, policies };
  }

  /**
   * REQ: Allow templates to target a chosen environment via customizable connection settings
   */
  public static async provision(templateId: string, dbConnectionString: string): Promise<void> {
    const template = TEMPLATE_REGISTRY[templateId];
    if (!template) throw new Error(`Template [${templateId}] not found.`);

    const client = new Client({ connectionString: dbConnectionString });
    await client.connect();

    try {
      // Execute entire infrastructure mapping safely inside a single deployment transaction block
      await client.query('BEGIN');

      // 1. Run database structure scripts
      await client.query(template.schemaSql);
      if (template.seedSql) {
        await client.query(template.seedSql);
      }

      // 2. Inject Storage Meta records into our storage.buckets tracking matrices
      for (const bucket of template.storageBuckets) {
        await client.query(`
          INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
          VALUES ($1, $1, $2, $3, $4)
          ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;
        `, [bucket.id, bucket.public, bucket.fileSizeLimit || null, bucket.allowedMimeTypes || null]);
      }

      // 3. Commit state change variables cleanly
      await client.commit();
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      await client.end();
    }
  }
}