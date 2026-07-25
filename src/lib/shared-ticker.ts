/**
 * Shared 1-second ticker. Components that tick every second (e.g. countdown
 * cards) subscribe here instead of each running their own setInterval, so N
 * visible cards cost ONE interval + one wakeup per second instead of N.
 */

type TickCallback = () => void;

const listeners = new Set<TickCallback>();
let interval: ReturnType<typeof setInterval> | null = null;

const tick = (): void => {
  listeners.forEach((callback) => {
    try {
      callback();
    } catch {
      // A throwing listener must not kill the shared ticker for everyone else.
    }
  });
};

export const subscribeToSharedTicker = (callback: TickCallback): (() => void) => {
  listeners.add(callback);

  if (!interval) {
    interval = setInterval(tick, 1000);
  }

  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && interval) {
      clearInterval(interval);
      interval = null;
    }
  };
};

/** Test hook: current subscriber count. */
export const getSharedTickerListenerCount = (): number => listeners.size;
