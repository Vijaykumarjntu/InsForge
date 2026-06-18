export enum McpConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
}

export interface McpServerInstance {
  config: McpServerConfig;
  state: McpConnectionState;
  process: any | null; // Node ChildProcess
  pendingRequests: Map<string | number, { resolve: Function; reject: Function }>;
  error: string | null;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}