import { Command } from 'commander';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export const registerDbCommands = (program: Command) => {
//   const dbGroup = program
//     .command('db')
//     .description('Manage your local InsForge database infrastructure stack');
    program
//   .command('db-start')
//   .description('Spin up the local docker-compose database cluster seamlessly')
    .command('db-start')
    .description('Spin up the local docker-compose database cluster seamlessly')
    .action(() => {
      console.log('🏁 Initiating Orca Hunt: insforge db start...');
      
      // Navigate cleanly up to the workspace root where docker-compose.yml lives
      const rootDir = path.resolve(process.cwd());
      const composePath = path.join(rootDir, 'docker-compose.yml');

      if (!fs.existsSync(composePath)) {
        console.error(`❌ Crucial Error: Could not locate docker-compose.yml at ${rootDir}`);
        console.error('Make sure you run this command from the root folder of InsForge!');
        process.exit(1);
      }

      try {
        console.log('🐳 Verifying Docker daemon state...');
        execSync('docker info', { stdio: 'ignore' });
        console.log('✅ Docker engine verified active.');

        console.log('🚀 Launching Postgres, PostgREST, and networking layers via Compose...');
        
        // Execute the docker compose orchestrator seamlessly
        // We target the specific db services to keep your machine lean
        execSync('docker compose up postgres postgrest -d', {
          cwd: rootDir,
          stdio: 'inherit', // Forwards all real-time stream text directly to your terminal!
        });

        console.log('\n✨ Killer Whale Captured! Your database stack is fully booted and healthy.');
        console.log('📊 Run your type generator next to sync database shapes.');
      } catch (err: any) {
        console.error('\n💥 Mission Failed! Docker orchestrator encountered an obstacle.');
        console.error(`Details: ${err.message}`);
        process.exit(1);
      }
    });
    // --- 🔥 NEW KILLER WHALE: DB STOP ---
  program
    .command('db-stop')
    .description('Gracefully spin down and halt the local database container stack')
    .action(() => {
      console.log('🛑 Halting Infrastructure: insforge db-stop...');
      
      const rootDir = path.resolve(process.cwd());
      const composePath = path.join(rootDir, 'docker-compose.yml');

      if (!fs.existsSync(composePath)) {
        console.error(`❌ Error: Could not locate docker-compose.yml at ${rootDir}`);
        process.exit(1);
      }

      try {
        console.log('🐳 Sending stop signals to active database containers...');
        
        // This spins down only our targeted db services, leaving unrelated stuff alone
        execSync('docker compose stop postgres postgrest', {
          cwd: rootDir,
          stdio: 'inherit', // Let us see the real-time shutdown confirmation!
        });

        console.log('\n✨ Database cluster halted successfully. Resources freed! 🌊⚓');
      } catch (err: any) {
        console.error('\n💥 Encountered an error trying to halt the services.');
        console.error(`Details: ${err.message}`);
        process.exit(1);
      }
    });
    // --- 🔥 THE FINAL WHALE: DB PUSH / RESET ---
  program
    .command('db-push')
    .description('Force-push and reinitialize the database schema from your local SQL migration files')
    .action(() => {
      console.log('🔄 Reinitializing Database State: insforge db-push...');
      
      const rootDir = path.resolve(process.cwd());
      
      try {
        console.log('🧼 Re-executing docker-compose setup hooks to clean and migrate data schemas...');
        
        // This stops the containers, wipes the active anonymous volumes holding dirty data,
        // and brings them right back up so your 01-init.sql, 02-jwt.sql scripts run completely fresh!
        execSync('docker compose down -v', { cwd: rootDir, stdio: 'inherit' });
        
        console.log('🚀 Spawning clean, newly migrated container instances...');
        execSync('docker compose up postgres postgrest -d', { cwd: rootDir, stdio: 'inherit' });
        
        console.log('\n✨ Database schema pushed and migrated perfectly! Your environment is completely pristine. 🌊💎');
      } catch (err: any) {
        console.error(`\n💥 Failed to migrate database: ${err.message}`);
        process.exit(1);
      }
    });
    // --- ⚔️ THE GHOST WHALE: DB DIFF ---
  program
    .command('db-diff')
    .description('Compare the active local database schema layout against your base initialization scripts')
    .action(() => {
      console.log('🔍 Executing Schema Comparison: insforge db-diff...');
      
      const rootDir = path.resolve(process.cwd());
      
      try {
        console.log('📡 Extracting current live schema state from Docker container...');
        
        // This runs pg_dump inside the active container to extract ONLY the schema structure (no table data rows)
        const liveSchema = execSync(
          'docker compose exec postgres pg_dump -U postgres -d insforge --schema-only',
          { cwd: rootDir, encoding: 'utf-8' }
        );

        console.log('📂 Reading your local base initialization script blueprint...');
        const initSqlPath = path.join(rootDir, 'deploy', 'docker-init', 'db', 'db-init.sql');
        
        if (!fs.existsSync(initSqlPath)) {
          console.warn('⚠️ Base migration script (db-init.sql) not found. Displaying full active schema layout instead:');
          console.log(liveSchema);
          return;
        }

        // A true structural diff
        const baseSchema = fs.readFileSync(initSqlPath, 'utf-8');

        if (liveSchema.trim() === baseSchema.trim()) {
          console.log('\n✅ Perfect Parity! No schema drift detected between your local SQL files and the live database. 🛡️');
        } else {
          console.log('\n⚠️ SCHEMA DRIFT DETECTED! Your live database has changes not recorded in your base db-init.sql script.');
          console.log('--- LIVE SCHEMA PREVIEW ---');
          // Showing a quick line snapshot comparison
          console.log(`Live Schema Size: ${liveSchema.length} characters.`);
          console.log(`Base Blueprint Size: ${baseSchema.length} characters.`);
          console.log('---------------------------');
          console.log('💡 Tip: Update your SQL files under deploy/docker-init/db to lock in your live dashboard adjustments.');
        }
      } catch (err: any) {
        console.error(`\n💥 Failed to generate schema diff: ${err.message}`);
        process.exit(1);
      }
    });
};