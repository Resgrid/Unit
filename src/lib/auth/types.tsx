export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SsoLoginCredentials {
  /** The external token: id_token (OIDC) or base64 SAMLResponse (SAML 2.0) */
  externalToken: string;
  provider: 'oidc' | 'saml2';
  username: string;
  /** Current authenticator (TOTP) code; required when the account has 2FA enabled. */
  otpCode?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
  /** Current authenticator (TOTP) code; required when the account has 2FA enabled. */
  otpCode?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
  expiration_date: string;
}

export interface LoginResponse {
  successful: boolean;
  message: string;
  authResponse: AuthResponse | null;
  /** The server requires a TOTP code for this account (error mfa_required / invalid_totp). */
  mfaRequired?: boolean;
  /** A code was supplied but rejected (error invalid_totp). */
  invalidOtp?: boolean;
}
export interface ProfileModel {
  sub: string;
  jti: string;
  useage: string;
  at_hash: string;
  nbf: number;
  exp: number;
  iat: number;
  iss: string;
  name: string;
  oi_au_id: string;
  oi_tkn_id: string;
}

export type AuthStatus = 'idle' | 'signedIn' | 'signedOut' | 'loading' | 'error' | 'onboarding' | 'mfaRequired';

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  refreshTokenExpiresOn: string | null;
  status: AuthStatus;
  error: string | null;
  profile: ProfileModel | null;
  userId: string | null;
  refreshTimeoutId: ReturnType<typeof setTimeout> | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  ssoLogin: (credentials: SsoLoginCredentials) => Promise<void>;
  /** Retries the pending SSO exchange with the user's authenticator code (2FA challenge). */
  retrySsoWithOtp: (otpCode: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  isFirstTime: boolean;
  isAuthenticated: () => boolean;
  setIsOnboarding: () => void;
}
