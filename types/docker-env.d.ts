/**
 * Type declarations for Docker runtime environment injection
 * When running in Docker, the entrypoint script injects window.__ENV__
 */

interface DockerEnvConfig {
  APP_ENV: string;
  NAME: string;
  SCHEME: string;
  VERSION: string;
  BASE_API_URL: string;
  API_VERSION: string;
  RESGRID_API_URL: string;
  CHANNEL_HUB_NAME: string;
  REALTIME_GEO_HUB_NAME: string;
  LOGGING_KEY: string;
  APP_KEY: string;
  UNIT_MAPBOX_PUBKEY: string;
  IS_MOBILE_APP: boolean;
  SENTRY_DSN: string;
  COUNTLY_APP_KEY: string;
  COUNTLY_SERVER_URL: string;
}

declare global {
  interface Window {
    __ENV__?: DockerEnvConfig;
  }
}

export {};
