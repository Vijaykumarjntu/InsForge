import fs from 'fs';
import { DatabaseTableService } from './src/services/database/database-table.service.js';

async function runLocalStreamToFileTest() {
  const tableService = DatabaseTableService.getInstance();
  
  // Create a real writable file stream directed right onto your local desktop path
  const localFileStream = fs.createWriteStream('./simulated_database_export.csv');
  
  console.log('?? Opening high-performance database stream extraction channel...');
  
  // Express Response has the exact same stream.Writable interface as fs.createWriteStream!
  await tableService.streamTableToCsv('public', 'users', localFileStream as any);
  
  localFileStream.end();
  console.log('?? Stream closed completely! Open "simulated_database_export.csv" in your project folder!');
}

runLocalStreamToFileTest().catch(console.error);
