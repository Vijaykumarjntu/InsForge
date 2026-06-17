import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function runIntegrationTestSuite() {
  console.log('🧪 Starting CLI Integration Test Suite...');
  
  const rootDir = path.resolve(process.cwd());
  const testOutputPath = path.join(rootDir, 'types', 'database.test.ts');
  
  // Ensure target folder exists
  if (!fs.existsSync(path.dirname(testOutputPath))) {
    fs.mkdirSync(path.dirname(testOutputPath), { recursive: true });
  }

  try {
    console.log('📡 Step 1: Invoking CLI Type Generator against live database container...');
    
    // Execute our CLI command pointing to a test file destination
    execSync(
      `npx tsx packages/cli/src/index.ts gen types typescript --postgres-url postgresql://postgres:postgres@localhost:5432/insforge -o types/database.test.ts`,
      { cwd: rootDir, stdio: 'inherit' }
    );

    console.log('📂 Step 2: Verifying file generation on disk...');
    if (!fs.existsSync(testOutputPath)) {
      throw new Error('❌ Integration Failure: Output file was never created on disk!');
    }
    console.log('✅ Output file exists.');

    console.log('🔍 Step 3: Inspecting output content for strict schema criteria layout...');
    const fileContent = fs.readFileSync(testOutputPath, 'utf-8');

    const validationCriteria = [
      { name: 'Database Skeleton Structure', regex: /export interface Database/ },
      { name: 'Enums Block Mapping', regex: /Enums:\s*\{/ },
      { name: 'Tables Block Mapping', regex: /Tables:\s*\{/ },
      { name: 'Functions / RPC Block Mapping', regex: /Functions:\s*\{/ },
      { name: 'Cryptographic Functions (e.g., pgp_sym_encrypt)', regex: /pgp_sym_encrypt/ }
    ];

    let passedAll = true;
    validationCriteria.forEach(criterion => {
      if (criterion.regex.test(fileContent)) {
        console.log(`  🔹 [PASS] Verified: ${criterion.name}`);
      } else {
        console.error(`  ❌ [FAIL] Missing Expected Layout: ${criterion.name}`);
        passedAll = false;
      }
    });

    if (!passedAll) {
      throw new Error('❌ Integration Failure: Generated file content failed schema validation requirements.');
    }

    // Clean up test artifact after successful validation
    fs.unlinkSync(testOutputPath);
    
    console.log('\n🎉 INTEGRATION TEST SUITE PASSED SUCCESSFULLY! ALL CRITERIA SECURED. 🎖️');
    
  } catch (error: any) {
    console.error('\n💥 Integration Test Suite Encountered A Critical Regression Exception:');
    console.error(error.message);
    process.exit(1);
  }
}

// Fire the suite
runIntegrationTestSuite();