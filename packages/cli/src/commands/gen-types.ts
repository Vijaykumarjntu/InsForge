import { Command } from 'commander';
import * as fs from 'fs';
import { CodegenIntrospectionService } from '../../../../backend/src/services/database/codegen-introspection.service';
import { CodegenFormatter } from '../../../../backend/src/services/database/codegen-formatter';

export const registerGenTypesCommand = (program: Command) => {
  program
    .command('gen types typescript')
    .description('Introspects live database layout to emit strict TypeScript typings')
    .option('--local', 'Introspect the active local docker-compose database stack cluster')
    .option('--linked', 'Introspect the remote database workspace linked to this folder')
    .option('--project-id <ref>', 'Target an explicit project ID metadata hash layout')
    .option('--schema <list>', 'Comma-separated target database tracking schemas list', 'public')
    .option('--postgres-url <url>', 'Bypass authorization hooks, target a direct string connection url')
    .option('-o, --output <file>', 'Output directly to file target destination instead of standard stdout out stream')
    // .action(async (options) => {
    //   let connectionUrl = '';

    //   // Determine appropriate configuration stream priority
    //   if (options.postgresUrl) {
    //     connectionUrl = options.postgresUrl;
    //   } else if (options.local) {
    //     // Points natively straight into your running insforge-postgres-1 cluster node
    //     connectionUrl = 'postgresql://postgres:postgres@localhost:5432/postgres';
    //   } else {
    //     console.error('❌ Configuration missing. Supply valid --local, --linked or --postgres-url parameter values.');
    //     process.exit(1);
    //   }

    //   const targetedSchemas = options.schema.split(',').map((s: string) => s.trim());
      
    //   try {
    //     const introspector = new CodegenIntrospectionService(connectionUrl);
    //     await introspector.connect();

    //     const enums = await introspector.getEnums(targetedSchemas);
    //     const columns = await introspector.getColumns(targetedSchemas);
    //     const relations = await introspector.getRelationships(targetedSchemas);
    //     const rpcs = await introspector.getRpcs(targetedSchemas);

    //     await introspector.disconnect();

    //     const formatter = new CodegenFormatter();
    //     const tsOutputCode = formatter.generateTypeScript(targetedSchemas, enums, columns, relations, rpcs);

    //     if (options.output) {
    //       fs.writeFileSync(options.output, tsOutputCode, 'utf-8');
    //       console.log(`\n✅ Typings generation complete! Written successfully to ${options.output}`);
    //     } else {
    //       // Output cleanly directly to stdout stream for terminal redirections
    //       process.stdout.write(tsOutputCode);
    //     }
    //   } catch (err: any) {
    //     console.error(`\n💥 Fatal Codegen Exception Encountered: ${err.message}`);
    //     process.exit(1);
    //   }
    // });
    .action(async (options) => {
      console.log('🏁 Command triggered! Options received:', options);
      let connectionUrl = '';

      if (options.postgresUrl) {
        connectionUrl = options.postgresUrl;
      } else if (options.local) {
        connectionUrl = 'postgresql://postgres:postgres@localhost:5432/postgres';
      } else {
        console.error('❌ Configuration missing. Supply valid --local, --linked or --postgres-url parameter values.');
        process.exit(1);
      }

      const targetedSchemas = options.schema.split(',').map((s: string) => s.trim());
      console.log(`🔌 Attempting connection to: ${connectionUrl} for schemas:`, targetedSchemas);
      
      try {
        const introspector = new CodegenIntrospectionService(connectionUrl);
        console.log('📡 Connecting to Postgres client...');
        await introspector.connect();
        console.log('✅ Connected successfully! Fetching metadata...');

        const enums = await introspector.getEnums(targetedSchemas);
        console.log(`📊 Fetched ${enums.length} enums.`);
        const columns = await introspector.getColumns(targetedSchemas);
        console.log(`📊 Fetched ${columns.length} columns.`);
        const relations = await introspector.getRelationships(targetedSchemas);
        console.log(`📊 Fetched ${relations.length} relationships.`);
        const rpcs = await introspector.getRpcs(targetedSchemas);
        console.log(`📊 Fetched ${rpcs.length} RPCs.`);

        await introspector.disconnect();
        console.log('⚙️ Running formatter...');

        const formatter = new CodegenFormatter();
        const tsOutputCode = formatter.generateTypeScript(targetedSchemas, enums, columns, relations, rpcs);

        console.log('✨ Formatting complete! Length:', tsOutputCode.length);

        if (options.output) {
          fs.writeFileSync(options.output, tsOutputCode, 'utf-8');
          console.log(`\n✅ Written successfully to ${options.output}`);
        } else {
          process.stdout.write(tsOutputCode);
        }
      } catch (err: any) {
        console.error(`\n💥 Fatal Codegen Exception Encountered: ${err.message}`);
        process.exit(1);
      }
    });
};