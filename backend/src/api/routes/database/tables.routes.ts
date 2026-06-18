import { Router, Response, NextFunction } from 'express';
import { verifyAdmin, AuthRequest } from '@/api/middlewares/auth.js';
import { DatabaseTableService } from '@/services/database/database-table.service.js';
import { DatabaseManager } from '@/infra/database/database.manager.js';
import { successResponse } from '@/utils/response.js';
import { AppError } from '@/utils/errors.js';
import {
  ERROR_CODES,
  createTableRequestSchema,
  updateTableSchemaRequestSchema,
} from '@insforge/shared-schemas';
import { AuditService } from '@/services/logs/audit.service.js';
import { normalizeDatabaseSchemaName } from '@/services/database/helpers.js';

const router = Router();
const tableService = DatabaseTableService.getInstance();
const auditService = AuditService.getInstance();

// All table routes accept either JWT token or API key authentication
// router.use(verifyAdmin);

// List all tables
router.get('/', verifyAdmin, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schemaName = normalizeDatabaseSchemaName(_req.query.schema);
    const tables = await tableService.listTables(schemaName);
    successResponse(res, tables);
  } catch (error) {
    next(error);
  }
});

// Create a new table
router.post('/', verifyAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validation = createTableRequestSchema.safeParse(req.body);
    if (!validation.success) {
      throw new AppError(
        validation.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
        400,
        ERROR_CODES.INVALID_INPUT,
        'Please check the request body, it must conform with the CreateTableRequest schema.'
      );
    }

    const schemaName = normalizeDatabaseSchemaName(req.query.schema);
    const { tableName, columns, rlsEnabled } = validation.data;
    const result = await tableService.createTable(schemaName, tableName, columns, rlsEnabled);

    DatabaseManager.clearColumnTypeCache(tableName, schemaName);

    // Log audit for table creation
    await auditService.log({
      actor: req.user?.email || 'api-key',
      action: 'CREATE_TABLE',
      module: 'DATABASE',
      details: {
        schemaName,
        tableName,
        columns,
        rlsEnabled,
      },
      ip_address: req.ip,
    });

    successResponse(res, result, 201);
  } catch (error) {
    next(error);
  }
});

// Get table schema
router.get(
  '/:tableName/schema',
  verifyAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { tableName } = req.params;
      const schemaName = normalizeDatabaseSchemaName(req.query.schema);
      const schema = await tableService.getTableSchema(schemaName, tableName);
      successResponse(res, schema);
    } catch (error) {
      next(error);
    }
  }
);

// Update table schema
router.patch(
  '/:tableName/schema',
  verifyAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { tableName } = req.params;
      const schemaName = normalizeDatabaseSchemaName(req.query.schema);

      const validation = updateTableSchemaRequestSchema.safeParse(req.body);
      if (!validation.success) {
        throw new AppError(
          validation.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
          400,
          ERROR_CODES.INVALID_INPUT,
          'Please check the request body, it must conform with the UpdateTableRequest schema.'
        );
      }

      const operations = validation.data;
      const result = await tableService.updateTableSchema(schemaName, tableName, operations);

      DatabaseManager.clearColumnTypeCache(tableName, schemaName);

      // Log audit for table schema update
      await auditService.log({
        actor: req.user?.email || 'api-key',
        action: 'UPDATE_TABLE',
        module: 'DATABASE',
        details: {
          schemaName,
          tableName,
          operations,
        },
        ip_address: req.ip,
      });

      successResponse(res, result);
    } catch (error) {
      next(error);
    }
  }
);

// Delete a table
router.delete(
  '/:tableName',
  verifyAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { tableName } = req.params;
      const schemaName = normalizeDatabaseSchemaName(req.query.schema);
      const result = await tableService.deleteTable(schemaName, tableName);

      DatabaseManager.clearColumnTypeCache(tableName, schemaName);

      // Log audit for table deletion
      await auditService.log({
        actor: req.user?.email || 'api-key',
        action: 'DELETE_TABLE',
        module: 'DATABASE',
        details: {
          schemaName,
          tableName,
        },
        ip_address: req.ip,
      });

      successResponse(res, result);
    } catch (error) {
      next(error);
    }
  }
);

// Export a database table as a streaming CSV file download
router.get(
  '/:tableName/export',
  verifyAdmin,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { tableName } = req.params;
      const schemaName = normalizeDatabaseSchemaName(req.query.schema);

      // 1. Configure the response headers to stream an explicit file payload
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${schemaName}_${tableName}_export_${Date.now()}.csv"`
      );
      res.setHeader('Transfer-Encoding', 'chunked');

      // 2. Fire the memory-isolated chunked data stream pipeline
      await tableService.streamTableToCsv(schemaName, tableName, res);
      
      // 3. Close out the response loop cleanly
      res.end();
    } catch (error) {
      // If headers haven't been flushed yet, pass the error along to the global logger pipeline
      if (!res.headersSent) {
        next(error);
      } else {
        console.error('Stream transmission context broken mid-transit:', error);
      }
    }
  }
);

export { router as databaseTablesRouter };
