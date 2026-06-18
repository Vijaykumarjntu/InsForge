import { spawn, ChildProcess } from 'child_process';
import { readline } from 'readline';
import { AppError } from '../../utils/errors.js';
import { ERROR_CODES } from '@insforge/shared-schemas';
import {
  McpConnectionState,
  McpServerConfig,
  McpServerInstance,
  JsonRpcRequest,
  JsonRpcResponse
} from './mcp-types.js';

export class McpClientManager {
  private static instance: McpClientManager;
  // Persistent memory state tracking active connections
  private instances = new Map<string, McpServerInstance>();
  private requestIdCounter = 0;

  private constructor() {}

  public static getInstance(): McpClientManager {
    if (!McpClientManager.instance) {
      McpClientManager.instance = new McpClientManager();
    }
    return McpClientManager.instance;
  }

  /**
   * Get the connection status and state metadata for a specific server instance
   */
  public getConnectionState(serverId: string): McpServerInstance | undefined {
    return this.instances.get(serverId);
  }

  /**
   * Initialize a persistent background stdio connection to an MCP Server
   */
  public async connect(config: McpServerConfig): Promise<void> {
    if (this.instances.has(config.id)) {
      const current = this.instances.get(config.id);
      if (current?.state === McpConnectionState.CONNECTED) {
        return; // Already established safely
      }
    }

    const instance: McpServerInstance = {
      config,
      state: McpConnectionState.CONNECTING,
      process: null,
      pendingRequests: new Map(),
      error: null
    };

    this.instances.set(config.id, instance);

    try {
      // Spawn the sub-process using the command parameters safely
      const child: ChildProcess = spawn(config.command, config.args, {
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      instance.process = child;

      // Ensure errors on process startup are captured
      child.on('error', (err) => {
        console.error(`[MCP Server ${config.id}] Critical runtime spawn error:`, err);
        instance.state = McpConnectionState.ERROR;
        instance.error = err.message;
      });

      // Stream error output into the central logging grid
      child.stderr?.on('data', (data) => {
        console.warn(`[MCP Server ${config.id} stderr]:`, data.toString().trim());
      });

      // Track sudden process exits cleanly
      child.on('exit', (code, signal) => {
        console.log(`[MCP Server ${config.id}] Process exited with code ${code}, signal ${signal}`);
        this.cleanupStateOnTermination(config.id);
      });

      // Set up line-by-line JSON parsing for incoming standard output data stream lines
      if (child.stdout) {
        let lineBuffer = '';
        
        child.stdout.on('data', (chunk) => {
          lineBuffer += chunk.toString();
          let boundaryIndex;
          
          while ((boundaryIndex = lineBuffer.indexOf('\n')) !== -1) {
            const line = lineBuffer.substring(0, boundaryIndex).trim();
            lineBuffer = lineBuffer.substring(boundaryIndex + 1);
            if (line) {
              this.handleIncomingMessage(config.id, line);
            }
          }
        });
      }

      // Initialize the official handshake connection state flag
      instance.state = McpConnectionState.CONNECTED;
    } catch (err: any) {
      instance.state = McpConnectionState.ERROR;
      instance.error = err.message;
      throw new AppError(
        `Failed to establish connection to MCP Server: ${err.message}`,
        500,
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        'Please verify the installation path or command configurations.'
      );
    }
  }

  /**
   * EXPLICIT DISCONNECTION PATHWAY
   * Forcefully terminates sub-processes, tears down state listeners, and clears pending calls
   */
  public async disconnect(serverId: string): Promise<void> {
    const instance = this.instances.get(serverId);
    if (!instance) {
      return; // No active instance found to tear down
    }

    console.log(`📡 [MCP Manager] Explicit disconnection initiated for target: ${serverId}`);

    // 1. Reject any outstanding JSON-RPC requests trapped in transit
    for (const [requestId, deferred] of instance.pendingRequests.entries()) {
      deferred.reject(
        new AppError(
          'MCP connection explicitly closed by host request.',
          503,
          ERROR_CODES.INTERNAL_SERVER_ERROR,
          'The action was cancelled during link shutdown.'
        )
      );
    }
    instance.pendingRequests.clear();

    // 2. Kill the underlying process handle forcefully
    if (instance.process) {
      // Remove exit listeners to prevent double trigger loops during deliberate closeouts
      instance.process.removeAllListeners('exit');
      instance.process.removeAllListeners('error');

      try {
        instance.process.stdin?.end();
        instance.process.kill('SIGTERM');
        
        // Give it a brief moment to process cleanup signals, then verify termination
        setTimeout(() => {
          try {
            if (instance.process && !instance.process.killed) {
              instance.process.kill('SIGKILL');
            }
          } catch {}
        }, 1000);
      } catch (killErr) {
        console.error(`Error killing MCP sub-process process framework:`, killErr);
      }
    }

    // 3. Purge state from tracking structures cleanly
    instance.state = McpConnectionState.DISCONNECTED;
    instance.process = null;
    this.instances.delete(serverId);
    console.log(`🏆 [MCP Manager] Disconnection completed. Server ${serverId} state cleanly wiped.`);
  }

  /**
   * Route a JSON-RPC response back to its original pending caller promise
   */
  private handleIncomingMessage(serverId: string, rawLine: string): void {
    try {
      const response: JsonRpcResponse = JSON.parse(rawLine);
      const instance = this.instances.get(serverId);
      if (!instance || response.id === undefined || response.id === null) return;

      const pending = instance.pendingRequests.get(String(response.id));
      if (pending) {
        instance.pendingRequests.delete(String(response.id));
        if (response.error) {
          pending.reject(response.error);
        } else {
          pending.resolve(response.result);
        }
      }
    } catch (e) {
      console.error(`[MCP Manager] Failed parsing JSON-RPC frame line payload:`, e);
    }
  }

  private cleanupStateOnTermination(serverId: string): void {
    const instance = this.instances.get(serverId);
    if (instance) {
      instance.state = McpConnectionState.DISCONNECTED;
      instance.process = null;
      this.instances.delete(serverId);
    }
  }
}