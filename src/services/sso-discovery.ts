import axios from 'axios';

import { getBaseApiUrl } from '@/lib/storage/app';

export interface DepartmentSsoConfig {
  ssoEnabled: boolean;
  providerType: 'oidc' | 'saml2' | null;
  authority: string | null;
  clientId: string | null;
  metadataUrl: string | null;
  entityId: string | null;
  idpSsoUrl: string | null;
  allowLocalLogin: boolean;
  requireSso: boolean;
  requireMfa: boolean;
  oidcRedirectUri: string;
  oidcScopes: string;
  departmentId: number | null;
  departmentName: string | null;
}

export interface SsoConfigForUserResult {
  config: DepartmentSsoConfig | null;
  userExists: boolean;
}

/**
 * Fetch the SSO configuration for a given username (and optional departmentId).
 * Uses the updated /api/v4/Connect/sso-config-for-user endpoint which does
 * username-first discovery: it resolves the user's active/default department
 * automatically, or scopes to a specific department when departmentId is provided.
 *
 * Returns { config: null, userExists: false } when the account does not exist
 * (the backend returns allowLocalLogin:true / ssoEnabled:false to avoid
 * account enumeration, so we treat a null / empty response as "not found").
 */
export async function fetchSsoConfigForUser(username: string, departmentId?: number): Promise<SsoConfigForUserResult> {
  try {
    const params: Record<string, string | number> = { username };
    if (departmentId !== undefined) {
      params.departmentId = departmentId;
    }

    const response = await axios.get(`${getBaseApiUrl()}/connect/sso-config-for-user`, {
      params,
    });

    const data = response.data?.Data ?? null;
    if (!data) {
      return { config: null, userExists: false };
    }

    return { config: data as DepartmentSsoConfig, userExists: true };
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      // User not a member of the specified department
      return { config: null, userExists: false };
    }
    return { config: null, userExists: false };
  }
}
