import { Command } from 'commander';

export const registerAuthTestCommand = (program: Command) => {
  program
    .command('auth-test')
    .description('Simulate local Auth and RLS policy contexts to test security restrictions')
    .requiredOption('--role <name>', 'The target Postgres role to assume (e.g., authenticated, anon)')
    .requiredOption('--user <id>', 'The simulated user ID context (maps to request.jwt.claim.sub)')
    .requiredOption('--table <name>', 'The target database table to probe')
    .requiredOption('--action <type>', 'The CRUD action operation to test (SELECT, INSERT, UPDATE, DELETE)')
    .option('--payload <json>', 'JSON data payload string for simulating INSERT or UPDATE statements')
    .option('--where <clause>', 'Custom SQL filter criteria to target rows (e.g., "id = 5")')
    .action(async (options) => {
      console.log('🛡️  Initiating InsForge Auth & RLS Simulation Layer...');
      console.log(`📊 Parameters: Role [${options.role}] | User [${options.user}] | Action [${options.action}] on [${options.table}]\n`);

      // 1. Format the target action statement safely
      let probeQuery = '';
      const targetAction = options.action.toUpperCase();

      if (targetAction === 'SELECT') {
        const criteria = options.where ? `WHERE ${options.where}` : 'LIMIT 5';
        probeQuery = `SELECT * FROM ${options.table} ${criteria}`;
      } else if (targetAction === 'INSERT') {
        if (!options.payload) {
          console.error('💥 Error: Testing an INSERT statement requires providing a --payload option string.');
          process.exit(1);
        }
        try {
          const data = JSON.parse(options.payload);
          const keys = Object.keys(data).join(', ');
          const vals = Object.values(data).map(v => typeof v === 'string' ? `'${v}'` : v).join(', ');
          probeQuery = `INSERT INTO ${options.table} (${keys}) VALUES (${vals})`;
        } catch {
          console.error('💥 Error: Failed to parse provided --payload string. Ensure it is valid JSON.');
          process.exit(1);
        }
      } else if (targetAction === 'UPDATE') {
        if (!options.payload) {
          console.error('💥 Error: Testing an UPDATE statement requires providing a --payload option string.');
          process.exit(1);
        }
        const criteria = options.where ? `WHERE ${options.where}` : '';
        probeQuery = `UPDATE ${options.table} SET ${options.payload} ${criteria}`;
      } else if (targetAction === 'DELETE') {
        const criteria = options.where ? `WHERE ${options.where}` : '';
        probeQuery = `DELETE FROM ${options.table} ${criteria}`;
      }

      // 2. Establish a direct connection using the workspace's pg client driver
      // Since we are running inside the monorepo workspace, we can dynamically require it
      // let Client;
      // try {
      //   const pgModule = require('pg');
      //   Client = pgModule.Client;
      // } catch {
      //   console.error('💥 Error: Could not resolve the database client driver module ("pg") in this workspace.');
      //   process.exit(1);
      // }

      // 2. Establish a direct connection using the workspace's pg client driver
      let Client;
      try {
        const pgModule = await import('pg');
        Client = pgModule.default?.Client || pgModule.Client;
      } catch (e: any) {
        console.error('💥 Error: Could not resolve the database client driver module ("pg") in this workspace.');
        process.exit(1);
      }

      // const client = new Client({
      //   connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres'
      // });

      const client = new Client({
        connectionString: 'postgresql://postgres:postgres@localhost:5432/insforge'
      });
      
      try {
        await client.connect();

        // Execute sandboxed transaction queries step-by-step
        await client.query('BEGIN');
        await client.query(`SET LOCAL role '${options.role}'`);
        await client.query(`SET LOCAL "request.jwt.claim.sub" = '${options.user}'`);
        await client.query(`SET LOCAL "request.jwt.claim.email" = '${options.user}'`);

        // Execute the actual data action query probe
        const result = await client.query(probeQuery);

        console.log('🟢 [SIMULATION PASSED]: Security policies permit this operation.');
        console.log('---------------------------------------------------------');
        
        if (targetAction === 'SELECT' && result.rows) {
          console.log(JSON.stringify(result.rows, null, 2));
        } else {
          console.log(`Command executed successfully. Rows affected: ${result.rowCount || 0}`);
        }
        
        console.log('---------------------------------------------------------');

      } catch (err: any) {
        console.log('🔴 [SIMULATION DENIED]: Operation blocked by database engine layers.');
        console.log('---------------------------------------------------------');
        
        if (err.message.includes('insufficient_privilege') || err.code === '42501') {
          console.log(`🛡️  RLS Violation: Role '${options.role}' lacks permissions to ${targetAction} on table '${options.table}'.`);
        } else {
          console.log(`⚠️  SQL Engine Error: ${err.message}`);
        }
        
        console.log('---------------------------------------------------------');
      } finally {
        // Always try to cleanly rollback the transaction and close down the socket pool connection loop safely
        try {
          await client.query('ROLLBACK');
          await client.end();
        } catch {}
        console.log('✨ Safe Verification Complete: Transaction rolled back with zero data mutations.');
      }
    });
};    