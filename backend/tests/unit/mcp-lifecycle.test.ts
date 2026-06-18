import { describe, expect, it, vi, beforeEach } from 'vitest';
import { McpClientManager } from '../../src/infra/mcp/mcp-client.manager';
import { McpConnectionState, McpServerConfig } from '../../src/infra/mcp/mcp-types';

// Create a persistent mock handle reference that we can manipulate inside individual tests
const mockKill = vi.fn();
const mockRemoveAllListeners = vi.fn();
const mockStdinEnd = vi.fn();

// 1. Intercept the child_process module import engine entirely before loading the test execution scope
vi.mock('child_process', () => {
  return {
    spawn: vi.fn().mockImplementation(() => {
      return {
        stdin: { end: mockStdinEnd, write: vi.fn() },
        stdout: { on: vi.fn(), pipe: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: mockKill,
        removeAllListeners: mockRemoveAllListeners,
        killed: false
      };
    })
  };
});

describe('Model Context Protocol (MCP) Lifecycle & Persistent State Manager', () => {
  let mcpManager: McpClientManager;

  beforeEach(() => {
    // Clear out singleton configuration state cache records
    (McpClientManager as any).instance = null;
    mcpManager = McpClientManager.getInstance();

    // Clear call history on our global spy monitors
    vi.clearAllMocks();
  });

  it('correctly initialises an MCP connection target and transitions into CONNECTED state status', async () => {
    const config: McpServerConfig = {
      id: 'db-advisor-engine',
      name: 'PostgreSQL Database Advisor Engine',
      command: 'node',
      args: ['dist/advisor.js']
    };

    // Establish the connection line
    await mcpManager.connect(config);

    // Introspect active tracking state
    const liveInstance = mcpManager.getConnectionState('db-advisor-engine');
    
    expect(liveInstance).toBeDefined();
    expect(liveInstance?.state).toBe(McpConnectionState.CONNECTED);
    expect(liveInstance?.config.name).toBe('PostgreSQL Database Advisor Engine');
  });

  it('EXECUTES AN EXPLICIT DISCONNECT COMMAND: completely cleans up the process thread handle and purges tracking registers', async () => {
    const config: McpServerConfig = {
      id: 'fs-inspector',
      name: 'FileSystem Context Engine',
      command: 'bun',
      args: ['start']
    };

    // 1. Connect to setup initial state map anchoring profiles
    await mcpManager.connect(config);
    expect(mcpManager.getConnectionState('fs-inspector')?.state).toBe(McpConnectionState.CONNECTED);

    // 2. Fire the explicit cancellation command pass
    await mcpManager.disconnect('fs-inspector');

    // 3. Assert that tracking buffers are completely wiped and sub-processes are terminated
    const finalInstance = mcpManager.getConnectionState('fs-inspector');
    expect(finalInstance).toBeUndefined(); // Verification profile cleanly purged out of memory!
    
    expect(mockRemoveAllListeners).toHaveBeenCalled();
    expect(mockKill).toHaveBeenCalledWith('SIGTERM');
  });
});