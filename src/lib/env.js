/*
 * This file should not be modified directly; use `env.js` in the project root to add your client environment variables.
 * If you import `Env` from `@env`, this is the file that will be loaded.
 * You can only access the client environment variables here.
 *
 * For Docker deployments, environment variables are injected at runtime via window.__ENV__
 * For native/dev builds, environment variables come from expo-constants
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Check if we're running in a Docker container (web with runtime env injection)
 * @returns {boolean}
 */
const isDockerRuntime = () => {
  if (Platform.OS !== 'web') {
    return false;
  }
  // Check if window.__ENV__ exists (injected by docker-entrypoint.sh)
  return typeof window !== 'undefined' && window.__ENV__ !== undefined;
};

/**
 * Get environment configuration
 * - For Docker web deployments: uses window.__ENV__ (runtime injection)
 * - For native/dev builds: uses expo-constants (build-time)
 *
 * @type {typeof import('../../env.js').ClientEnv}
 */
// @ts-ignore - Function type inference issue with mixed Docker/native config
const getEnvConfig = () => {
  if (isDockerRuntime()) {
    // Docker runtime - use injected environment variables
    return window.__ENV__;
  }
  // Native/dev build - use expo-constants
  //@ts-ignore // Don't worry about TypeScript here; we know we're passing the correct environment variables to `extra` in `app.config.ts`
  return Constants.expoConfig?.extra ?? {};
};

// @ts-ignore - Type inference issue with function call
export const Env = getEnvConfig();
