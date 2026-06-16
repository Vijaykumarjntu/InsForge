import { Router, Response, NextFunction } from 'express';
import { DatabaseAdvanceService } from '@/services/database/database-advance.service.js';
import { AuditService } from '@/services/logs/audit.service.js';
import { DatabaseManager } from '@/infra/database/database.manager.js';
import { verifyAdmin, AuthRequest } from '@/api/middlewares/auth.js';
import { AppError } from '@/utils/errors.js';
import { upload, handleUploadError } from '@/api/middlewares/upload.js';
import {
  ERROR_CODES,
  rawSQLRequestSchema,
  exportRequestSchema,
  importRequestSchema,
  bulkUpsertRequestSchema,
} from '@insforge/shared-schemas';
import logger from '@/utils/logger.js';
import { SocketManager } from '@/infra/socket/socket.manager.js';
import { DataUpdateResourceType, ServerEvents } from '@/types/socket.js';
import { successResponse } from '@/utils/response.js';
import { analyzeQuery, type DatabaseResourceUpdate } from '@/utils/sql-parser.js';
import { buildQualifiedTableKey } from '@/services/database/helpers.js';

import { QueryVisualizerService } from '@/services/database/query-visualizer.service.js';
import { PostgresExplainPlanRoot, VisualizerPlanMetrics } from '@/types/database.js';
import { explainQueryRequestSchema } from '@insforge/shared-schemas'; // Or import your localized definition


// Define the response shape contract directly at the gate of the route file
interface ExplainPlanResponsePayload {
  rawPlan: PostgresExplainPlanRoot[];
  metrics: VisualizerPlanMetrics;
}

const visualizerService = QueryVisualizerService.getInstance();

const router = Router();
const dbAdvanceService = DatabaseAdvanceService.getInstance();
const auditService = AuditService.getInstance();

/**
 * Invalidate column type cache for tables affected by schema-changing SQL
 */
function invalidateColumnTypeCacheFromChanges(changes: DatabaseResourceUpdate[]): void {
  for (const change of changes) {
    if (change.type === 'table' || change.type === 'tables') {
      if (change.name) {
        DatabaseManager.clearColumnTypeCache(change.name);
      } else {
        // DROP TABLE / CREATE TABLE don't preserve table name in the parser — clear all
        DatabaseManager.clearColumnTypeCache();
      }
    }
  }
}

/**
 * Execute raw SQL query with root privileges.
 * POST /api/database/advance/rawsql/unrestricted
 *
 * Root back door for project-admin-only operations that need full database owner privileges.
 */
router.post(
  '/rawsql/unrestricted',
  verifyAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      const validation = rawSQLRequestSchema.safeParse(req.body);
      if (!validation.success) {
        throw new AppError(
          validation.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
          400,
          ERROR_CODES.INVALID_INPUT
        );
      }

      const { query, params = [] } = validation.data;

      const response = await dbAdvanceService.executeRawSQL(query, params, true);

      await auditService.log({
        actor: req.user?.email || 'api-key',
        action: 'EXECUTE_RAW_SQL_UNRESTRICTED',
        module: 'DATABASE',
        details: {
          query: query.substring(0, 300), // Limit query length in audit log
          paramCount: params.length,
          rowsAffected: response.rowCount,
          executionRole: 'root',
        },
        ip_address: req.ip,
      });

      // Broadcast changes if any modifying statements detected
      const changes = analyzeQuery(query);
      if (changes.length > 0) {
        invalidateColumnTypeCacheFromChanges(changes);
        const socket = SocketManager.getInstance();
        socket.broadcastToRoom(
          'role:project_admin',
          ServerEvents.DATA_UPDATE,
          { resource: DataUpdateResourceType.DATABASE, data: { changes } },
          'system'
        );
      }

      successResponse(res, response);
    } catch (error: unknown) {
      logger.warn('Unrestricted raw SQL execution error:', error);
      next(error);
    }
  }
);

/**
 * Database Advisor Scanning Routine
 * POST /api/advisor/scan
 * Accessible strictly via Admin Authorization loops
 */
router.post(
  '/advisor/scan',
  verifyAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const results = await dbAdvanceService.runAdvisorScan();
      
      await auditService.log({
        actor: req.user?.email || 'api-key',
        action: 'RUN_DATABASE_ADVISOR_SCAN',
        module: 'ADVISOR',
        details: { findings_discovered: results.summary.recommendationsCount },
        ip_address: req.ip,
      });

      successResponse(res, results);
    } catch (error: unknown) {
      next(error);
    }
  }
);

/**
 * Execute raw SQL query with project_admin privileges.
 * POST /api/database/advance/rawsql
 */
router.post('/rawsql', verifyAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Validate request body
    // 🛠️ Force a flat, unbuffered string output that Docker cannot ignore
    logger.info("🚨 🚨 🚨 FORCE PRINT: WE ARE ABSOLUTELY INSIDE THE RAWSQL ROUTE HANDLER 🚨 🚨 🚨");
    // logger.info({message: "we are inside the explain route"});
    // alert("this is inside the rawsql");
    const validation = rawSQLRequestSchema.safeParse(req.body);
    if (!validation.success) {
      throw new AppError(
        validation.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
        400,
        ERROR_CODES.INVALID_INPUT
      );
    }

    const { query, params = [] } = validation.data;

    const response = await dbAdvanceService.executeRawSQL(query, params);

    await auditService.log({
      actor: req.user?.email || 'api-key',
      action: 'EXECUTE_RAW_SQL',
      module: 'DATABASE',
      details: {
        query: query.substring(0, 300), // Limit query length in audit log
        paramCount: params.length,
        rowsAffected: response.rowCount,
        executionRole: 'project_admin',
      },
      ip_address: req.ip,
    });

    // Broadcast changes if any modifying statements detected
    const changes = analyzeQuery(query);
    if (changes.length > 0) {
      invalidateColumnTypeCacheFromChanges(changes);
      const socket = SocketManager.getInstance();
      socket.broadcastToRoom(
        'role:project_admin',
        ServerEvents.DATA_UPDATE,
        { resource: DataUpdateResourceType.DATABASE, data: { changes } },
        'system'
      );
    }

    successResponse(res, response);
  } catch (error: unknown) {
    logger.warn('Raw SQL execution error:', error);
    next(error);
  }
});

/**
 * Export database data
 * POST /api/database/advance/export
 */
router.post('/export', verifyAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Validate request body
    const validation = exportRequestSchema.safeParse(req.body);
    if (!validation.success) {
      throw new AppError(
        validation.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
        400,
        ERROR_CODES.INVALID_INPUT
      );
    }

    const {
      tables,
      format,
      includeData,
      includeFunctions,
      includeSequences,
      includeViews,
      rowLimit,
    } = validation.data;
    const response = await dbAdvanceService.exportDatabase(
      tables,
      format,
      includeData,
      includeFunctions,
      includeSequences,
      includeViews,
      rowLimit
    );

    // Log audit for database export
    await auditService.log({
      actor: req.user?.email || 'api-key',
      action: 'EXPORT_DATABASE',
      module: 'DATABASE',
      details: {
        format: response.format,
      },
      ip_address: req.ip,
    });

    successResponse(res, response);
  } catch (error: unknown) {
    logger.warn('Database export error:', error);
    next(error);
  }
});

/**
 * Bulk upsert data from file upload (CSV/JSON)
 * POST /api/database/advance/bulk-upsert
 * Expects multipart/form-data with:
 * - file: CSV or JSON file
 * - table: Target table name
 * - upsertKey: Optional column for upsert operations
 */
router.post(
  '/bulk-upsert',
  verifyAdmin,
  upload.single('file'),
  handleUploadError,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError('File is required', 400, ERROR_CODES.INVALID_INPUT);
      }

      // Validate request body
      const validation = bulkUpsertRequestSchema.safeParse(req.body);
      if (!validation.success) {
        throw new AppError(
          validation.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
          400,
          ERROR_CODES.INVALID_INPUT
        );
      }

      const { schema, table, upsertKey } = validation.data;

      const response = await dbAdvanceService.bulkUpsertFromFile(
        schema,
        table,
        req.file.buffer,
        req.file.originalname,
        upsertKey
      );

      // Log audit
      await auditService.log({
        actor: req.user?.email || 'api-key',
        action: 'BULK_UPSERT',
        module: 'DATABASE',
        details: {
          schemaName: schema,
          table,
          filename: req.file.originalname,
          fileSize: req.file.size,
          upsertKey: upsertKey || null,
          rowsAffected: response.rowsAffected,
          totalRecords: response.totalRecords,
        },
        ip_address: req.ip,
      });

      const socket = SocketManager.getInstance();
      socket.broadcastToRoom(
        'role:project_admin',
        ServerEvents.DATA_UPDATE,
        {
          resource: DataUpdateResourceType.DATABASE,
          data: {
            changes: [
              { type: 'records', name: buildQualifiedTableKey(table, schema) },
            ] as DatabaseResourceUpdate[],
          },
        },
        'system'
      );

      successResponse(res, response);
    } catch (error: unknown) {
      logger.warn('Bulk upsert error:', error);

      next(error);
    }
  }
);

/**
 * Import database data from SQL file
 * POST /api/database/advance/import
 * Expects a SQL file upload via multipart/form-data
 */
router.post(
  '/import',
  verifyAdmin,
  upload.single('file'),
  handleUploadError,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      const validation = importRequestSchema.safeParse(req.body);
      if (!validation.success) {
        throw new AppError(
          validation.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
          400,
          ERROR_CODES.INVALID_INPUT
        );
      }

      const { truncate } = validation.data;

      if (!req.file) {
        throw new AppError('SQL file is required', 400, ERROR_CODES.INVALID_INPUT);
      }

      const response = await dbAdvanceService.importDatabase(
        req.file.buffer,
        req.file.originalname,
        req.file.size,
        truncate
      );

      // Log audit for database import
      await auditService.log({
        actor: req.user?.email || 'api-key',
        action: 'IMPORT_DATABASE',
        module: 'DATABASE',
        details: {
          truncate,
          filename: response.filename,
          fileSize: response.fileSize,
          tablesAffected: response.tables.length,
          rowsImported: response.rowsImported,
        },
        ip_address: req.ip,
      });

      // Import may contain DDL — clear all column type caches
      DatabaseManager.clearColumnTypeCache();

      const socket = SocketManager.getInstance();
      socket.broadcastToRoom(
        'role:project_admin',
        ServerEvents.DATA_UPDATE,
        { resource: DataUpdateResourceType.DATABASE },
        'system'
      );

      successResponse(res, response);
    } catch (error: unknown) {
      logger.warn('Database import error:', error);
      next(error);
    }
  }
);


/**
 * @route   POST /api/database/advance/explain
 * @desc    Generates transaction-isolated EXPLAIN ANALYZE visual plan tree telemetry
 * @access  Admin Only (Matches Supabase experience natively)
 */
router.post(
  '/explain',
  verifyAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Enforce strict type validation layout matching rawSQLRequestSchema routines
      logger.info({message: "we are inside the explain route",});
      const parseResult = explainQueryRequestSchema.safeParse(req.body);
      console.log("this is the req body which we are using");
      console.log(req.body);
      if (!parseResult.success) {
        throw new AppError('Invalid explain request payload data properties', 400,ERROR_CODES.INVALID_INPUT);
      }

      const { query } = parseResult.data;
      logger.info(`SQL Editor: Admin user ${req.user?.id || 'agent'} requested Explain tree diagram execution`);

      // 2. Invoke the performance visualizer isolation engine
      const planResult = await visualizerService.generateExplainPlan(query);

      // 3. Dispatch uniform success response back to dashboard UI tab
      // res.status(200).json(
      //   successResponse({
      //     rawPlan: planResult.rawPlan,
      //     metrics: planResult.metrics
      //   }, 'Execution plan generated successfully')
      // );

      // 3. Dispatch uniform success response back to dashboard UI tab
      // res.status(200).json(
      //   successResponse<ExplainPlanResponsePayload>({
      //     rawPlan: planResult.rawPlan,
      //     metrics: planResult.metrics
      //   }, 'Execution plan generated successfully')
      // );
      // 3. Dispatch uniform success response back to dashboard UI tab
      // res.status(200).json(
      //   successResponse({
      //     rawPlan: planResult.rawPlan,
      //     metrics: planResult.metrics
      //   } as any, 'Execution plan generated successfully')
      // );
      // Alternative option if successResponse is an Express runner utility:
      // 3. Dispatch uniform success response back to dashboard UI tab safely
      res.status(200).json({
        success: true,
        message: 'Execution plan generated successfully',
        data: {
          rawPlan: planResult.rawPlan,
          metrics: planResult.metrics
        }
      });
      return;

    } catch (error: any) {
      logger.error(`Explain Route Error: ${error.message}`);
      
      // Acceptance Criteria: Render syntax/permission errors readably without breaking components
      // res.status(200).json({
      //   success: false,
      //   error: error.message || 'Database optimizer failed to parse execution plan tree structure.'
      // });
      // 🛠️ Pass the error along to next() so your Docker framework logger prints the standard HTTP Request info line
      next(error);
    }
  }
);

// export default router;

export default router;
