import axios from 'axios';

/**
 * Returns true for transient connectivity failures where the request never
 * received a response from the server — e.g. the device is offline, DNS/TLS
 * failed, the request timed out, or the app was cold-launched in the background
 * with restricted network access.
 *
 * These conditions are expected and recoverable, so callers should log them at
 * `warn` level (which does NOT report to Sentry) instead of `error`, while still
 * treating genuine server responses (4xx/5xx) as real errors.
 */
export const isNetworkError = (error: unknown): boolean => axios.isAxiosError(error) && (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' || !error.response);
