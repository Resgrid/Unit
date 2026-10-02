import axios from 'axios';

import { CLIENT_HEADER, RESGRID_CLIENT } from '@/lib/mfa/client-app';
import { getBaseApiUrl } from '@/lib/storage/app';

export interface DepartmentSsoConfig {
  ssoEnabled: boolean;
  providerType: 'oidc' | 'saml2' | null;
  authority: string | null;
  clientId: string | null;
  metadataUrl: string | null;
  entityId: string | null;
  /** Where a SAML sign-in without the broker starts (discovery's SamlLoginUrl): this server's page, sent on to the IdP. */
  samlLoginUrl: string | null;
  allowLocalLogin: boolean;
  requireSso: boolean;
  requireMfa: boolean;
  oidcRedirectUri: string;
  oidcScopes: string;
  departmentId: number | null;
  departmentName: string | null;
  /** A system-encrypted department reference for `Sso/Begin` (passkey workbook section 7.3 discovery fix). */
  departmentToken: string | null;
  /** Whether sign-in can go through the Resgrid broker for this department now (plan section 7.7.2). */
  brokeredSsoAvailable: boolean;
}

type WireConfig = Record<string, unknown>;

/**
 * The v4 API is PascalCase (`SsoEnabled`, `Authority`, ...), like every other v4 model; reading the camelCase names left
 * every field undefined, so SSO looked disabled. Both spellings are read so an older server still works.
 */
const read = (data: WireConfig, name: string): unknown => data[name.charAt(0).toUpperCase() + name.slice(1)] ?? data[name];

const text = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);

export const normalizeSsoConfig = (data: unknown): DepartmentSsoConfig | null => {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const wire = data as WireConfig;
  const providerType = text(read(wire, 'providerType'));
  const departmentId = read(wire, 'departmentId');
  return {
    ssoEnabled: read(wire, 'ssoEnabled') === true,
    providerType: providerType === 'oidc' || providerType === 'saml2' ? providerType : null,
    authority: text(read(wire, 'authority')),
    clientId: text(read(wire, 'clientId')),
    metadataUrl: text(read(wire, 'metadataUrl')),
    entityId: text(read(wire, 'entityId')),
    samlLoginUrl: text(read(wire, 'samlLoginUrl')),
    allowLocalLogin: read(wire, 'allowLocalLogin') !== false,
    requireSso: read(wire, 'requireSso') === true,
    requireMfa: read(wire, 'requireMfa') === true,
    oidcRedirectUri: text(read(wire, 'oidcRedirectUri')) ?? '',
    oidcScopes: text(read(wire, 'oidcScopes')) ?? '',
    departmentId: typeof departmentId === 'number' && departmentId > 0 ? departmentId : null,
    departmentName: text(read(wire, 'departmentName')),
    departmentToken: text(read(wire, 'departmentToken')),
    brokeredSsoAvailable: read(wire, 'brokeredSsoAvailable') === true,
  };
};

export interface SsoConfigForUserResult {
  config: DepartmentSsoConfig | null;
  userExists: boolean;
}

// The server answers with this app's own legacy OIDC redirect URI (each app has its own scheme), so it is told which app
// is asking.
const clientHeaders = { [CLIENT_HEADER]: RESGRID_CLIENT };

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
      headers: clientHeaders,
    });

    const config = normalizeSsoConfig(response.data?.Data);
    if (!config) {
      return { config: null, userExists: false };
    }

    return { config, userExists: true };
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      // User not a member of the specified department
      return { config: null, userExists: false };
    }
    return { config: null, userExists: false };
  }
}
