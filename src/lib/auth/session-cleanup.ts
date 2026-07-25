/**
 * Session-cleanup registry. The auth store must trigger a full app-data wipe on
 * EVERY logout path (manual, forced 401, refresh rejection), but the reset
 * service imports stores that import the api client that imports the auth
 * store — a static import would be a module cycle. This leaf module (zero
 * imports) breaks the cycle: the reset service registers its handler here at
 * module load, and the auth store invokes it.
 */

export type SessionCleanupHandler = () => Promise<void>;

let sessionCleanupHandler: SessionCleanupHandler | null = null;

export const registerSessionCleanupHandler = (handler: SessionCleanupHandler): void => {
  sessionCleanupHandler = handler;
};

export const runSessionCleanup = async (): Promise<void> => {
  if (sessionCleanupHandler) {
    await sessionCleanupHandler();
  }
};

/** Test hook. */
export const _getSessionCleanupHandler = (): SessionCleanupHandler | null => sessionCleanupHandler;
