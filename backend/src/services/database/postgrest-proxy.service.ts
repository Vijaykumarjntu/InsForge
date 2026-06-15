import axios, { AxiosResponse } from 'axios';
import http from 'http';
import https from 'https';
import { TokenManager } from '@/infra/security/token.manager.js';
import { SecretService } from '@/services/secrets/secret.service.js';
import logger from '@/utils/logger.js';

import { EncryptionManager } from '@/infra/security/encryption.manager.js';

const postgrestUrl = process.env.POSTGREST_BASE_URL || 'http://localhost:5430';

// Connection pooling for PostgREST
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 5000,
  maxSockets: 20,
  maxFreeSockets: 5,
  timeout: 10000,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 5000,
  maxSockets: 20,
  maxFreeSockets: 5,
  timeout: 10000,
});

const postgrestAxios = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 10000,
  maxRedirects: 0,
  headers: {
    Connection: 'keep-alive',
    'Keep-Alive': 'timeout=5, max=10',
  },
});

export interface ProxyRequest {
  method: string;
  path: string;
  query?: Record<string, unknown>;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  apiKey?: string;
}

export interface ProxyResponse {
  data: unknown;
  status: number;
  headers: Record<string, unknown>;
}

/**
 * Headers that should not be forwarded to the client
 */
const EXCLUDED_HEADERS = new Set([
  'content-length',
  'transfer-encoding',
  'connection',
  'content-encoding',
]);

export class PostgrestProxyService {
  private static instance: PostgrestProxyService;
  private tokenManager = TokenManager.getInstance();
  private secretService = SecretService.getInstance();
  private adminToken: string;

  private constructor() {
    this.adminToken = this.tokenManager.generateApiKeyToken();
  }

  public static getInstance(): PostgrestProxyService {
    if (!PostgrestProxyService.instance) {
      PostgrestProxyService.instance = new PostgrestProxyService();
    }
    return PostgrestProxyService.instance;
  }

  /**
   * Filter headers for forwarding to client (excludes problematic ones)
   */
  static filterHeaders(headers: Record<string, unknown>): Record<string, string> {
    const filtered: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      const normalizedKey = key.toLowerCase();
      if (
        !EXCLUDED_HEADERS.has(normalizedKey) &&
        !normalizedKey.startsWith('access-control-') &&
        value !== undefined
      ) {
        filtered[key] = value as string;
      }
    }
    return filtered;
  }

  /**
   * Forward request to PostgREST with retry logic
   */
  async forward(request: ProxyRequest): Promise<ProxyResponse> {
    const targetUrl = `${postgrestUrl}${request.path}`;

    const axiosConfig: {
      method: string;
      url: string;
      params?: Record<string, unknown>;
      headers: Record<string, string | string[] | undefined>;
      data?: unknown;
    } = {
      method: request.method,
      url: targetUrl,
      params: request.query,
      headers: {
        ...request.headers,
        host: undefined,
        'content-length': undefined,
      },
    };

    // Use admin token if valid API key provided
    if (request.apiKey) {
      const isValid = await this.secretService.verifyApiKey(request.apiKey);
      if (isValid) {
        axiosConfig.headers.authorization = `Bearer ${this.adminToken}`;
      }
    }

    if (request.body !== undefined) {
      axiosConfig.data = request.body;
    }

    // Retry logic
    let response: AxiosResponse | undefined;
    let lastError: unknown;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        response = await postgrestAxios(axiosConfig);
        break;
      } catch (error) {
        lastError = error;
        const shouldRetry = axios.isAxiosError(error) && !error.response && attempt < maxRetries;

        if (shouldRetry) {
          logger.warn(`PostgREST request failed, retrying (attempt ${attempt}/${maxRetries})`, {
            url: targetUrl,
            errorCode: (error as NodeJS.ErrnoException).code,
            message: (error as Error).message,
          });
          const backoffDelay = Math.min(200 * Math.pow(2.5, attempt - 1), 1000);
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        } else {
          throw error;
        }
      }
    }

    if (!response) {
      throw lastError || new Error('Failed to get response from PostgREST');
    }

    return {
      data: response.data,
      status: response.status,
      headers: response.headers as Record<string, unknown>,
    };
  }
}

/**
 * High-performance lookup cache for active system-registered encrypted columns.
 * Emulates the 'system.encrypted_columns' catalog repository dynamic mappings state.
 */
export const CACHED_ENCRYPTED_COLUMNS = new Set<string>([
  'integrations.credentials',
  'user_providers.access_token',
  'user_providers.refresh_token'
]);

/**
 * Parse incoming PostgREST paths to extract target table targets (e.g., /integrations?select=... -> integrations)
 */
function extractTableNameFromProxyPath(path: string): string {
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  return cleanPath.split('?')[0].split('/')[0];
}

/**
 * Security Shield: Intercepts inbound proxy requests to apply encryption matrices
 * and actively reject queries attempting to sort or filter sensitive fields.
 */
export function interceptAndProcessProxyRequest(req: ProxyRequest): ProxyRequest {
  const tableName = extractTableNameFromProxyPath(req.path);
  const updatedReq = { ...req };

  // 1. Enforce strict filter and sorting constraints on encrypted elements
  const searchQueriesString = JSON.stringify(req.query || {}) + req.path;
  for (const column of CACHED_ENCRYPTED_COLUMNS) {
    const [targetTable, columnName] = column.split('.');
    if (tableName === targetTable && searchQueriesString.includes(columnName)) {
      // Actively block filtered logic processing to guarantee ciphertext isolation
      if (
        searchQueriesString.includes('=' + columnName) || 
        searchQueriesString.includes('order=') || 
        searchQueriesString.includes('select=') === false && searchQueriesString.includes(columnName)
      ) {
        throw new Error(`Filtering, sorting, or grouping on encrypted column "${columnName}" is not supported.`);
      }
    }
  }

  // 2. Encrypt inbound write values (POST/PATCH/PUT) transparently
  if (['POST', 'PATCH', 'PUT'].includes(req.method.toUpperCase()) && req.body && typeof req.body === 'object') {
    const updatedBody = { ...(req.body as Record<string, any>) };
    
    for (const column of CACHED_ENCRYPTED_COLUMNS) {
      const [targetTable, columnName] = column.split('.');
      if (tableName === targetTable && updatedBody[columnName] !== undefined) {
        const valueToHide = updatedBody[columnName];
        const rawStringValue = typeof valueToHide === 'object' ? JSON.stringify(valueToHide) : String(valueToHide);
        updatedBody[columnName] = EncryptionManager.encrypt(rawStringValue);
      }
    }
    updatedReq.body = updatedBody;
  }

  return updatedReq;
}

/**
 * Transparently intercept inbound database query responses to unpack secret values
 */
export function interceptAndProcessProxyResponse(path: string, responseData: any): any {
  const tableName = extractTableNameFromProxyPath(path);
  
  if (!responseData) return responseData;

  const unpackRow = (row: any) => {
    if (!row || typeof row !== 'object') return row;
    const decryptedRow = { ...row };

    for (const column of CACHED_ENCRYPTED_COLUMNS) {
      const [targetTable, columnName] = column.split('.');
      if (tableName === targetTable && typeof decryptedRow[columnName] === 'string') {
        const cipherTextStr = decryptedRow[columnName];
        if (cipherTextStr.startsWith('v1:') || cipherTextStr.split(':').length === 3) {
          try {
            const plainTextStr = EncryptionManager.decrypt(cipherTextStr);
            // Attempt to restore JSON structural typing format automatically
            try {
              decryptedRow[columnName] = JSON.parse(plainTextStr);
            } catch {
              decryptedRow[columnName] = plainTextStr;
            }
          } catch {
            // Fallback cleanly on decryption collision
          }
        }
      }
    }
    return decryptedRow;
  };

  if (Array.isArray(responseData)) {
    return responseData.map(unpackRow);
  }
  return unpackRow(responseData);
}