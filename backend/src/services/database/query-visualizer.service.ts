import { DatabaseManager } from '@/infra/database/database.manager.js';
import logger from '@/utils/logger.js';

export interface VisualizerPlanMetrics {
  totalCost: number;
  executionTimeMs: number;
  hasSequentialScan: boolean;
  scanOperations: string[];
}

export class QueryVisualizerService {
  private static instance: QueryVisualizerService;
  private dbManager: DatabaseManager;

  private constructor() {
    this.dbManager = DatabaseManager.getInstance();
  }

  public static getInstance(): QueryVisualizerService {
    if (!QueryVisualizerService.instance) {
      QueryVisualizerService.instance = new QueryVisualizerService();
    }
    return QueryVisualizerService.instance;
  }

  /**
   * Safe execution interceptor that calculates query optimization plans.
   * Wraps statement in a transaction + mandatory ROLLBACK block so write actions
   * can be realistically analyzed without altering production tables.
   */
  public async generateExplainPlan(userQuery: string): Promise<{ rawPlan: any; metrics: VisualizerPlanMetrics }> {
    logger.info('Query Visualizer: Generating execution path diagram analysis...');
    const pool = this.dbManager.getPool();
    const client = await pool.connect();

    try {
      // 1. Establish an isolated transaction boundary
      await client.query('BEGIN');

      // 2. Wrap user statement inside the standard Postgres JSON explain modifier matrix
      const explainQuery = `EXPLAIN (ANALYZE, COSTS, VERBOSE, BUFFERS, FORMAT JSON) ${userQuery}`;
      const explainRes = await client.query(explainQuery);
      
      // 3. Always force an immediate rollback to guarantee complete data immutability
      await client.query('ROLLBACK');

      const rawPlan = explainRes.rows[0]?.['QUERY PLAN'] || explainRes.rows[0];
      const metrics = this.extractPlanTelemetry(rawPlan);

      return { rawPlan, metrics };
    } catch (error: any) {
      // Safety guard: guarantee connection closure if an execution compilation error spikes
      await client.query('ROLLBACK').catch(() => {});
      logger.error(`Query Visualizer execution failed: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Helper utility to deep scan the nested JSON execution plan object 
   * for bottlenecks like high cost numbers or Sequential Scans.
   */
  private extractPlanTelemetry(planNodeArray: any): VisualizerPlanMetrics {
    const rootNode = Array.isArray(planNodeArray) ? planNodeArray[0]?.['Plan'] : planNodeArray?.['Plan'];
    
    const metrics: VisualizerPlanMetrics = {
      totalCost: rootNode?.['Total Cost'] || 0,
      executionTimeMs: Array.isArray(planNodeArray) ? (planNodeArray[0]?.['Execution Time'] || 0) : 0,
      hasSequentialScan: false,
      scanOperations: []
    };

    const traverseNodes = (node: any) => {
      if (!node) return;

      const nodeType = node['Node Type'] || '';
      if (nodeType.includes('Scan')) {
        metrics.scanOperations.push(nodeType);
        if (nodeType === 'Seq Scan') {
          metrics.hasSequentialScan = true;
        }
      }

      if (node['Plans']) {
        for (const subPlan of node['Plans']) {
          traverseNodes(subPlan);
        }
      }
    };

    traverseNodes(rootNode);
    return metrics;
  }
}