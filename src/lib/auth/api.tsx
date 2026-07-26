import { Env } from '@env';
import axios from 'axios';
import queryString from 'query-string';

import { logger } from '@/lib/logging';

import { getBaseApiUrl } from '../storage/app';
import type { AuthResponse, LoginCredentials, LoginResponse, SsoLoginCredentials } from './types';

const authApi = axios.create({
  baseURL: getBaseApiUrl(),
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
});

// Dynamically update baseURL on every request to support
// custom server URL changes (e.g. self-hosted environments)
authApi.interceptors.request.use((config) => {
  config.baseURL = getBaseApiUrl();
  return config;
});

export const loginRequest = async (credentials: LoginCredentials): Promise<LoginResponse> => {
  try {
    const data = queryString.stringify({
      grant_type: 'password',
      username: credentials.username,
      password: credentials.password,
      scope: Env.IS_MOBILE_APP === 'true' ? 'openid profile offline_access mobile' : 'openid profile offline_access',
    });

    const response = await authApi.post<AuthResponse>('/connect/token', data);

    if (response.status === 200) {
      logger.info({
        message: 'Login successful',
      });

      return {
        successful: true,
        message: 'Login successful',
        authResponse: response.data,
      };
    } else {
      // Never log the response object — it carries config.data with the
      // urlencoded username/password body.
      logger.error({
        message: 'Login failed',
        context: { status: response.status },
      });

      return {
        successful: false,
        message: 'Login failed',
        authResponse: null,
      };
    }
  } catch (error) {
    // The sanitizer reduces axios errors to safe summaries (no request bodies).
    // Never include the username here — it is frequently an email address.
    logger.error({
      message: 'Login failed',
      context: { error },
    });
    throw error;
  }
};

export const refreshTokenRequest = async (refreshToken: string): Promise<AuthResponse> => {
  try {
    const data = queryString.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: '',
    });

    const response = await authApi.post<AuthResponse>('/connect/token', data);

    logger.info({
      message: 'Token refresh successful',
    });

    return response.data;
  } catch (error) {
    // The response interceptor (api/common/client.tsx) classifies this failure and
    // logs the actionable outcome (transient vs. credential rejection). Keep this at
    // warn so a transient refresh failure isn't duplicated to Sentry as an error.
    logger.warn({
      message: 'Token refresh request failed',
      context: { error },
    });
    throw error;
  }
};

/**
 * Exchange an external IdP token (OIDC id_token or SAML SAMLResponse) for
 * Resgrid access/refresh tokens via POST /api/v4/connect/external-token.
 */
export const ssoExternalTokenRequest = async (credentials: SsoLoginCredentials): Promise<LoginResponse> => {
  try {
    const data = queryString.stringify({
      provider: credentials.provider,
      external_token: credentials.externalToken,
      username: credentials.username,
      scope: Env.IS_MOBILE_APP === 'true' ? 'openid email profile offline_access mobile' : 'openid email profile offline_access',
    });

    const response = await authApi.post<AuthResponse>('/connect/external-token', data);

    if (response.status === 200) {
      logger.info({
        message: 'SSO external token exchange successful',
        context: { provider: credentials.provider },
      });

      return {
        successful: true,
        message: 'SSO login successful',
        authResponse: response.data,
      };
    }

    logger.error({
      message: 'SSO external token exchange failed',
      context: { status: response.status, provider: credentials.provider },
    });

    return { successful: false, message: 'SSO login failed', authResponse: null };
  } catch (error) {
    logger.error({
      message: 'SSO external token exchange error',
      context: { error, provider: credentials.provider },
    });
    throw error;
  }
};
