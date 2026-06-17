import { Command } from 'commander';
import { registerGenTypesCommand } from './commands/gen-types.js';
import { registerDbCommands } from './commands/db'; // Import the new killer whale!
const program = new Command();

program
  .name('insforge-cli')
  .description('InsForge Dev Workflow Management Tool')
  .version('0.0.1');

// Register the type generation command you built
registerGenTypesCommand(program);
registerDbCommands(program);
// Boot the program and parse your terminal options
program.parse(process.argv);