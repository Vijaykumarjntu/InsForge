import { Command } from 'commander';
import fs from 'fs';
import path from 'path';

/**
 * Utility helper to determine the user's host platform configuration directories
 */
function getMcpConfigPath(provider: string): string | null {
  const homeDir = process.env.USERPROFILE || process.env.HOME || '';
  if (!homeDir) return null;

  // Map out standard paths based on common provider types
  const target = provider.toLowerCase();
  if (target === 'claude') {
    return path.join(homeDir, 'AppData', 'Roaming', 'Claude', 'mcp_config.json');
  } else if (target === 'cursor') {
    return path.join(homeDir, 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'mcp_config.json');
  }
  
  // Default general fallback layout
  return path.join(homeDir, '.mcp', 'mcp_config.json');
}

export const registerMcpCommands = (program: Command) => {
  const mcpGroup = program
    .command('mcp')
    .description('Manage Model Context Protocol (MCP) lifecycle engines');

  mcpGroup
    .command('disconnect <provider>')
    .description('Explicitly unlinks an MCP provider, strips local config, and triggers UI updates')
    .action(async (provider: string) => {
      console.log(`📡 Initiating explicit disconnect procedures for provider: [${provider}]...`);

      // 1. Process local system configuration scrubbing
      const configPath = getMcpConfigPath(provider);
      if (configPath && fs.existsSync(configPath)) {
        try {
          const rawData = fs.readFileSync(configPath, 'utf-8');
          const configObj = JSON.parse(rawData);

          if (configObj.mcpServers && configObj.mcpServers['insforge']) {
            delete configObj.mcpServers['insforge'];
            fs.writeFileSync(configPath, JSON.stringify(configObj, null, 2), 'utf-8');
            console.log(`✅ Cleanly scrubbed InsForge signatures from local config file at: ${configPath}`);
          } else {
            console.log(`ℹ️ No active InsForge registration payload detected inside local configuration file.`);
          }
        } catch (fileErr) {
          console.warn(`⚠️ Warning: Could not patch local configuration file parameters: ${(fileErr as Error).message}`);
        }
      } else {
        console.log(`ℹ️ Local client configuration file target not found or skipped for platform mapping.`);
      }

      // 2. Synchronize remote backend state persistence layer
      try {
        console.log(`⚡ Dispatching explicit state transition signals to centralized workspace engine...`);
        
        // Pinging our new Express orchestration route
        const response = await fetch('http://localhost:3000/api/v1/mcp/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider }),
        });

        const outcome = await response.json() as { success: boolean; message?: string; error?: string };

        if (response.ok && outcome.success) {
          console.log(`\n✨ Success: ${outcome.message}`);
          console.log(`📊 All historical audit execution logs recorded remain fully preserved in your database.`);
        } else {
          console.error(`\n💥 Connection lifecycle sync returned an exception payload: ${outcome.error}`);
        }
      } catch (networkErr) {
        console.error(`\n💥 Network Error: Unable to contact local backend server workspace hub.`);
        console.error(`Ensure your backend service stack is up and active before calling lifecycle routines.`);
      }
    });
};