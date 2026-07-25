import axios from 'axios';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { logger } from '@/lib/logging';
import { getItem, removeItem, setItem } from '@/lib/storage';
import { getBaseApiUrl } from '@/lib/storage/app';

export interface SamlExchangeResult {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
  expiration_date?: string;
}

const SAML_RELAY_STATE_KEY = 'saml_pending_relay_state';

/**
 * SAML 2.0 SSO flow:
 *  1. Open the IdP-initiated SSO URL in the system browser.
 *  2. The IdP POSTs a SAMLResponse to the SP ACS endpoint.
 *  3. The backend ACS endpoint redirects to ResgridUnit://auth/callback?saml_response=<base64>.
 *  4. The app intercepts the deep link and calls handleDeepLink() to exchange
 *     the SAMLResponse for Resgrid access/refresh tokens.
 *
 * Login-CSRF hardening: a random RelayState nonce is generated when the flow
 * starts and appended to the IdP URL. The backend must echo it back as the
 * `relay_state` query param on the app callback. Callbacks without a matching
 * pending nonce are ignored, so an attacker cannot plant their own SAML
 * response on a victim's device.
 *
 * NOTE: The backend must expose a
 * GET/POST /api/v4/connect/saml-mobile-callback endpoint that accepts the
 * SAMLResponse and issues a 302 redirect to the app scheme (see plan Step 8).
 */
export function useSamlLogin() {
  /**
   * Open the IdP SSO URL in the system browser.
   * The browser will handle the full SAML redirect chain.
   */
  async function startSamlLogin(idpSsoUrl: string): Promise<void> {
    try {
      // Generate a one-time RelayState nonce for this flow. The backend ACS
      // endpoint must round-trip it back to the app callback.
      const relayState = Crypto.randomUUID();
      await setItem(SAML_RELAY_STATE_KEY, relayState);

      const separator = idpSsoUrl.includes('?') ? '&' : '?';
      await WebBrowser.openBrowserAsync(`${idpSsoUrl}${separator}RelayState=${encodeURIComponent(relayState)}`);
    } catch (error) {
      logger.error({
        message: 'Failed to open SAML SSO browser',
        context: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  /**
   * Validate that a deep-link SAML callback belongs to a flow this app started.
   * Returns the SAMLResponse when valid, null otherwise. The nonce is consumed
   * on use so a captured callback URL cannot be replayed.
   */
  async function validateSamlCallback(url: string): Promise<string | null> {
    const parsed = Linking.parse(url);
    const samlResponse = parsed.queryParams?.saml_response as string | undefined;
    const relayState = parsed.queryParams?.relay_state as string | undefined;

    if (!samlResponse) {
      logger.warn({ message: 'SAML deep-link missing saml_response param' });
      return null;
    }

    const pendingRelayState = getItem<string>(SAML_RELAY_STATE_KEY);
    if (!pendingRelayState) {
      // No SAML flow is pending — this callback was not initiated by this app.
      logger.warn({ message: 'Ignoring SAML callback with no pending flow' });
      return null;
    }

    if (!relayState || relayState !== pendingRelayState) {
      logger.warn({ message: 'Ignoring SAML callback with mismatched relay state' });
      return null;
    }

    // Consume the nonce — one-time use.
    await removeItem(SAML_RELAY_STATE_KEY);
    return samlResponse;
  }

  /**
   * Handle the deep-link callback that carries the base64-encoded SAMLResponse.
   * Returns the Resgrid token pair on success, or null on failure.
   *
   * @param url   The full deep-link URL (e.g. ResgridUnit://auth/callback?saml_response=...)
   * @param username  The username entered before the SAML flow started (used by the backend)
   */
  async function handleDeepLink(url: string, username: string): Promise<SamlExchangeResult | null> {
    try {
      const samlResponse = await validateSamlCallback(url);

      if (!samlResponse) {
        return null;
      }

      const params = new URLSearchParams({
        provider: 'saml2',
        external_token: samlResponse,
        username,
        scope: 'openid email profile offline_access mobile',
      });

      const resgridResponse = await axios.post<SamlExchangeResult>(`${getBaseApiUrl()}/connect/external-token`, params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

      logger.info({ message: 'SAML Resgrid token exchange successful' });
      return resgridResponse.data;
    } catch (error) {
      logger.error({
        message: 'SAML token exchange failed',
        context: { error: error instanceof Error ? error.message : String(error) },
      });
      return null;
    }
  }

  /**
   * Check whether a deep-link URL is a SAML callback.
   */
  function isSamlCallback(url: string): boolean {
    return url.includes('auth/callback') && url.includes('saml_response');
  }

  return { startSamlLogin, handleDeepLink, isSamlCallback, validateSamlCallback };
}
