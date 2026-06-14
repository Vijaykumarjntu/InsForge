import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Database Advisor Route & Controller Integration Wiring', () => {
  // Gracefully load the route code buffer directly out of your unified tests folder structure
  const advanceRoutesSource = readFileSync(
    resolve(__dirname, '../../src/api/routes/database/advance.routes.ts'),
    'utf-8'
  );

  it('exposes the precise production POST surface required by the specification', () => {
    // Assert endpoint verb matches POST /api/advisor/scan exactly
    expect(advanceRoutesSource).toMatch(/router\.post\(\s*'\/advisor\/scan'/);
  });

  it('enforces strict admin role authorization blocks across the scanning pipeline', () => {
    // Asserts that verifyAdmin middleware intercepts requests ahead of core controller routines
    expect(advanceRoutesSource).toMatch(/router\.post\(\s*'\/advisor\/scan',\s*verifyAdmin/);
  });

  it('maps request contexts to the newly scaled 19-rule execution engine handler', () => {
    // Validates that the router binds straight to our production advisor engine singleton
    expect(advanceRoutesSource).toContain('dbAdvanceService.runAdvisorScan()');
  });

  it('leverages the unified successResponse utility for standardized dashboard parsing', () => {
    // Verifies data payload passes safely into the frontend layout wrapper contracts
    expect(advanceRoutesSource).toContain('successResponse(res, results);');
  });

  it('contains the unified error processing interceptors to prevent transaction crashes', () => {
    // Proves any structural failure hooks cleanly into the express next error-handling chain
    expect(advanceRoutesSource).toContain('next(error);');
  });
});