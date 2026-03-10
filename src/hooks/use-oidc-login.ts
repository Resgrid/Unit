import axios from 'axios';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { logger } from '@/lib/logging';
import { getBaseApiUrl } from '@/lib/storage/app';

// Required for iOS / Android to close the browser after redirect
WebBrowser.maybeCompleteAuthSession();

export interface UseOidcLoginOptions {
  authority: string;
  clientId: string;
}

export interface OidcExchangeResult {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
  expiration_date?: string;
}

/**
 * Hook that drives the OIDC Authorization-Code + PKCE flow.
 *
 * Usage:
 *   const { request, promptAsync, exchangeForResgridToken } = useOidcLogin({ authority, clientId });
 *   // 1. call promptAsync() on button press
 *   // 2. watch response inside a useEffect and call exchangeForResgridToken(username) when type === 'success'
 */
export function useOidcLogin({ authority, clientId }: UseOidcLoginOptions) {
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'ResgridUnit',
    path: 'auth/callback',
  });

  const discovery = AuthSession.useAutoDiscovery(authority);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId,
      redirectUri,
      scopes: ['openid', 'email', 'profile', 'offline_access'],
      usePKCE: true,
      responseType: AuthSession.ResponseType.Code,
    },
    discovery
  );

  /**
   * Exchange the OIDC authorization code for a Resgrid access token.
   * Should be called after `response?.type === 'success'`.
   */
  async function exchangeForResgridToken(username: string): Promise<OidcExchangeResult | null> {
    if (response?.type !== 'success' || !request?.codeVerifier || !discovery) {
      logger.warn({
        message: 'OIDC exchange called in invalid state',
        context: { responseType: response?.type, hasCodeVerifier: !!request?.codeVerifier, hasDiscovery: !!discovery },
      });
      return null;
    }

    try {
      // Step 1: exchange auth code for id_token at the IdP
      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId,
          redirectUri,
          code: response.params.code,
          extraParams: { code_verifier: request.codeVerifier },
        },
        discovery
      );

      const idToken = tokenResponse.idToken;
      if (!idToken) {
        logger.error({ message: 'OIDC exchange: no id_token in IdP response' });
        return null;
      }

      // Step 2: exchange id_token for Resgrid access/refresh tokens
      const params = new URLSearchParams({
        provider: 'oidc',
        external_token: idToken,
        username,
        scope: 'openid email profile offline_access mobile',
      });

      const resgridResponse = await axios.post<OidcExchangeResult>(`${getBaseApiUrl()}/connect/external-token`, params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

      logger.info({ message: 'OIDC Resgrid token exchange successful' });
      return resgridResponse.data;
    } catch (error) {
      logger.error({
        message: 'OIDC token exchange failed',
        context: { error: error instanceof Error ? error.message : String(error) },
      });
      return null;
    }
  }

  return { request, response, promptAsync, exchangeForResgridToken, discovery };
}
