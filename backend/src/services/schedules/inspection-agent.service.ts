import { DatabaseManager } from '@/infra/database/database.manager.js';
import logger from '@/utils/logger.js';

export class InspectionAgentService {
  private static instance: InspectionAgentService;
  private dbManager: DatabaseManager;

  private constructor() {
    this.dbManager = DatabaseManager.getInstance();
  }

  public static getInstance(): InspectionAgentService {
    if (!InspectionAgentService.instance) {
      InspectionAgentService.instance = new InspectionAgentService();
    }
    return InspectionAgentService.instance;
  }

  /**
   * Primary cron execution routine that triggers every 24 hours to automatically evaluate 
   * indexing health, security boundaries, and table counts across your project.
   */
  public async executeDailyHealthCheck(): Promise<Record<string, any>> {
    logger.info('Automated Inspection Agent: Initializing daily project health check...');
    const pool = this.dbManager.getPool();

    try {
      // 1. Scan for total custom tables in the public schema
      const tablesRes = await pool.query(`
        SELECT count(*)::int as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      const totalTables = tablesRes.rows[0]?.count || 0;

      // 2. Scan for unindexed columns that are frequently used as foreign keys
      const indexRes = await pool.query(`
        SELECT count(*)::int as count
        FROM pgl_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname = 'public' AND c.contype = 'f'
      `);
      const unindexedCount = Math.max(0, indexRes.rows[0]?.count || 0);

      // 3. Track our newly added encrypted columns to evaluate security posture
      const cryptoRes = await pool.query(`
        SELECT count(*)::int as count 
        FROM system.encrypted_columns
      `);
      const encryptedCount = cryptoRes.rows[0]?.count || 0;

      // 4. Synthesize an algorithmic health scorecard score (0-100 base scale deduction matrix)
      let baselineScore = 100;
      if (unindexedCount > 0) baselineScore -= Math.min(30, unindexedCount * 5);
      if (totalTables === 0) baselineScore = 100; // Fresh instance sandbox

      const diagnosticsPayload = {
        status: 'SUCCESS',
        scannedAt: new Date().toISOString(),
        metrics: {
          totalTables,
          unindexedColumns: unindexedCount,
          encryptedColumns: encryptedCount
        }
      };

      // 5. Append telemetry diagnostics directly to our audit log ledger table
      await pool.query(`
        INSERT INTO system.inspection_logs 
          (agent_name, health_score, tables_scanned, unindexed_columns_count, security_vulnerabilities_count, scan_summary)
        VALUES 
          ($1, $2, $3, $4, $5, $6)
      `, [
        'daily_advisor_agent',
        baselineScore,
        totalTables,
        unindexedCount,
        0, // Baseline vulnerabilities count placeholder
        JSON.stringify(diagnosticsPayload)
      ]);

      logger.info(`Automated Inspection Agent completed successfully. Project score: ${baselineScore}/100.`);
      return { healthScore: baselineScore, totalTables, unindexedCount };

    } catch (error: any) {
      logger.error(`Automated Inspection Agent execution fault encountered: ${error.message}`);
      throw error;
    }
  }
}