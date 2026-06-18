import axios from 'axios';
import logger from '@/utils/logger.js';
import { getApiBaseUrl } from '@/utils/environment.js';
import { OAuthConfigService } from '@/services/auth/oauth-config.service.js';
import { OAuthProvider } from './base.provider.js';
import type { MicrosoftUserInfo, OAuthUserData } from '@/types/auth.js';

/**
 * Microsoft OAuth Service
 * Handles all Microsoft OAuth operations including URL generation, token exchange, and user info retrieval.
 * Upgraded to support custom Shared-Keys / Isolated Tenant OAuth routing.
 */
export class MicrosoftOAuthProvider implements OAuthProvider {
  private static instance: MicrosoftOAuthProvider;

  private constructor() {}

  public static getInstance(): MicrosoftOAuthProvider {
    if (!MicrosoftOAuthProvider.instance) {
      MicrosoftOAuthProvider.instance = new MicrosoftOAuthProvider();
    }
    return MicrosoftOAuthProvider.instance;
  }

  /**
   * Helper to resolve the correct Microsoft Authority base based on Shared-Keys/Tenant config
   */
  private getAuthorityEndpoint(config: any): string {
    // If a custom tenant ID or shared-key mapping is present, isolate the tenant traffic lane.
    // Otherwise, default back gracefully to the multi-tenant "common" gateway.
    const tenantId = config.tenantId || config.metadata?.tenantId || 'common';
    return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0`;
  }

  /**
   * Generate Microsoft OAuth authorization URL
   */
  async generateOAuthUrl(state?: string): Promise<string> {
    const oAuthConfigService = OAuthConfigService.getInstance();
    const config = await oAuthConfigService.getConfigByProvider('microsoft');
    if (!config) {
      throw new Error('Microsoft OAuth not configured');
    }

    const selfBaseUrl = getApiBaseUrl();
    const authorityBase = this.getAuthorityEndpoint(config);

    logger.debug('Microsoft OAuth Config resolution:', {
      clientId: config.clientId ? 'SET' : 'NOT SET',
      authorityBase,
    });

    const authUrl = new URL(`${authorityBase}/authorize`);
    authUrl.searchParams.set('client_id', config.clientId ?? '');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', `${selfBaseUrl}/api/auth/oauth/microsoft/callback`);
    authUrl.searchParams.set(
      'scope',
      config.scopes && config.scopes.length > 0
        ? config.scopes.join(' ')
        : 'openid email profile offline_access User.Read'
    );
    
    if (state) {
      authUrl.searchParams.set('state', state);
    }
    return authUrl.toString();
  }

  /**
   * Exchange Microsoft code for tokens
   */
  async exchangeCodeToToken(code: string): Promise<{ access_token: string; id_token?: string }> {
    const oAuthConfigService = OAuthConfigService.getInstance();
    const config = await oAuthConfigService.getConfigByProvider('microsoft');
    if (!config) {
      throw new Error('Microsoft OAuth not configured');
    }

    try {
      const authorityBase = this.getAuthorityEndpoint(config);
      logger.info('Exchanging Microsoft code for tokens via resolved authority', {
        hasCode: !!code,
        clientId: config.clientId?.substring(0, 10) + '...',
        authorityBase,
      });

      const clientSecret = await oAuthConfigService.getClientSecretByProvider('microsoft');
      const selfBaseUrl = getApiBaseUrl();

      const body = new URLSearchParams({
        client_id: config.clientId ?? '',
        client_secret: clientSecret ?? '',
        code,
        redirect_uri: `${selfBaseUrl}/api/auth/oauth/microsoft/callback`,
        grant_type: 'authorization_code',
        scope:
          config.scopes && config.scopes.length > 0
            ? config.scopes.join(' ')
            : 'openid email profile offline_access User.Read',
      });

      const response = await axios.post(
        `${authorityBase}/token`,
        body.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      if (!response.data.access_token) {
        throw new Error('Failed to get access token from Microsoft');
      }
      return {
        access_token: response.data.access_token,
        id_token: response.data.id_token,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        logger.error('Microsoft token exchange failed', {
          status: error.response.status,
          error: error.response.data,
        });
        throw new Error(`Microsoft OAuth error: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Get Microsoft user info via Graph API
   */
  async getUserInfo(accessToken: string): Promise<MicrosoftUserInfo> {
    try {
      const userResp = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const data = userResp.data as {
        id: string;
        displayName?: string;
        userPrincipalName?: string;
        mail?: string | null;
      };

      const email = data.mail || data.userPrincipalName || `${data.id}@users.noreply.microsoft.com`;
      const name = data.displayName || data.userPrincipalName || email;

      return {
        id: data.id,
        email,
        name,
      };
    } catch (error) {
      logger.error('Microsoft user info retrieval failed:', error);
      throw new Error(`Failed to get Microsoft user info: ${error}`);
    }
  }

  /**
   * Handle Microsoft OAuth callback
   */
  async handleCallback(payload: { code?: string; token?: string }): Promise<OAuthUserData> {
    if (!payload.code) {
      throw new Error('No authorization code provided');
    }

    const tokens = await this.exchangeCodeToToken(payload.code);
    const microsoftUserInfo = await this.getUserInfo(tokens.access_token);

    const userName = microsoftUserInfo.name || microsoftUserInfo.email.split('@')[0] || 'user';
    return {
      provider: 'microsoft',
      providerId: microsoftUserInfo.id,
      email: microsoftUserInfo.email,
      userName,
      avatarUrl: '', 
      identityData: microsoftUserInfo,
    };
  }
}