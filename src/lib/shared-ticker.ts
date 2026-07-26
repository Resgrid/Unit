/**
 * Shared 1-second ticker. Components that tick every second (e.g. countdown
 * cards) subscribe here instead of each running their own setInterval, so N
 * visible cards cost ONE interval + one wakeup per second instead of N.
 */

type TickCallback = () => void;

export interface SharedTickerSubscriptionOptions {
  onError: (error: unknown) => void;
}

interface TickListener {
  callback: TickCallback;
  onError: SharedTickerSubscriptionOptions['onError'];
}

const listeners = new Set<TickListener>();
let interval: ReturnType<typeof setInterval> | null = null;

const tick = (): void => {
  listeners.forEach(({ callback, onError }) => {
    try {
      callback();
    } catch (error) {
      onError(error);
    }
  });
};

export const subscribeToSharedTicker = (callback: TickCallback, options: SharedTickerSubscriptionOptions): (() => void) => {
  const listener = { callback, onError: options.onError };
  listeners.add(listener);

  if (!interval) {
    interval = setInterval(tick, 1000);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && interval) {
      clearInterval(interval);
      interval = null;
    }
  };
};

/** Test hook: current subscriber count. */
export const getSharedTickerListenerCount = (): number => listeners.size;
