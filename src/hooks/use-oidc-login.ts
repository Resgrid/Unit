import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { logger } from '@/lib/logging';

// Required for iOS / Android to close the browser after redirect
WebBrowser.maybeCompleteAuthSession();

export interface UseOidcLoginOptions {
  authority: string;
  clientId: string;
}

/**
 * Hook that drives the OIDC Authorization-Code + PKCE flow.
 *
 * Usage:
 *   const { request, promptAsync, exchangeForResgridToken } = useOidcLogin({ authority, clientId });
 *   // 1. call promptAsync() on button press
 *   // 2. watch response inside a useEffect and call exchangeForResgridToken() when type === 'success'
 *   // 3. pass the returned id_token to ssoLogin({ provider: 'oidc', externalToken: idToken, username })
 */
export function useOidcLogin({ authority, clientId }: UseOidcLoginOptions) {
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'resgridunit',
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
   * Exchange the OIDC authorization code for the IdP id_token.
   * Should be called after `response?.type === 'success'`.
   * Returns the raw id_token string for use as the externalToken in ssoLogin.
   */
  async function exchangeForResgridToken(): Promise<string | null> {
    if (response?.type !== 'success' || !request?.codeVerifier || !discovery) {
      logger.warn({
        message: 'OIDC exchange called in invalid state',
        context: { responseType: response?.type, hasCodeVerifier: !!request?.codeVerifier, hasDiscovery: !!discovery },
      });
      return null;
    }

    try {
      // Exchange auth code for id_token at the IdP
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

      logger.info({ message: 'OIDC code exchange successful, id_token obtained' });
      return idToken;
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
