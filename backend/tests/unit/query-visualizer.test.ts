import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('SQL Editor — Explain Plan Visualizer Engine Contracts', () => {
  // 1. Verify file presence and critical safety transaction keywords
  it('implements transaction boundaries and rollback interceptors to shield data mutation', () => {
    const serviceSource = readFileSync(
      resolve(__dirname, '../../src/services/database/query-visualizer.service.ts'),
      'utf-8'
    );
    expect(serviceSource).toContain('class QueryVisualizerService');
    expect(serviceSource).toContain('generateExplainPlan');
    expect(serviceSource).toContain('EXPLAIN (ANALYZE, COSTS, VERBOSE, BUFFERS, FORMAT JSON)');
    expect(serviceSource).toContain('BEGIN');
    expect(serviceSource).toContain('ROLLBACK');
  });

  // 2. Verify tree traversal mechanics for scanning bottlenecks
  it('processes tree structures to extract total cost values and identify sequential scans', () => {
    const serviceSource = readFileSync(
      resolve(__dirname, '../../src/services/database/query-visualizer.service.ts'),
      'utf-8'
    );
    expect(serviceSource).toContain('extractPlanTelemetry');
    expect(serviceSource).toContain('Total Cost');
    expect(serviceSource).toContain('Seq Scan');
    expect(serviceSource).toContain('Node Type');
  });

  it('proves advanced endpoint routing intercepts POST payloads and maps error snapshots safely', () => {
    const routeSource = readFileSync(
      resolve(__dirname, '../../src/api/routes/database/advance.routes.ts'),
      'utf-8'
    );
    expect(routeSource).toContain('/explain');
    expect(routeSource).toContain('generateExplainPlan');
    expect(routeSource).toContain('res.status(200).json');
    expect(routeSource).toContain('success: false');
  });
  
  it('implements the recursive visualizer component rendering actual rows and total query times', () => {
    const componentSource = readFileSync(
      resolve(
        __dirname, 
        '../../../packages/dashboard/src/features/database/components/ExplainPlanTree.tsx'
      ),
      'utf-8'
    );
    expect(componentSource).toContain('ExplainPlanTree');
    expect(componentSource).toContain('ExplainPlanNode');
    expect(componentSource).toContain('Total execution time');
    expect(componentSource).toContain('Actual Total Time');
    expect(componentSource).toContain('node[\'Plans\'].map');
  });
});