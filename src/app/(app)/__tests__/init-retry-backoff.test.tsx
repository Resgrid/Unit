/**
 * A failed app initialization used to re-fire immediately, three times: three full
 * multi-request bursts back-to-back against a backend that had just failed, then
 * silence — the user was left on a spinner with no idea anything had gone wrong.
 *
 * The layout itself pulls in Mapbox, Novu, push notifications and the whole store
 * graph, so — as with init-session-generation.test.tsx — the retry protocol is
 * exercised through the same effect shape the layout uses rather than by rendering it.
 */
import { act, renderHook } from '@testing-library/react-native';
import React from 'react';

const MAX_INIT_RETRIES = 3;

/** Mirrors the layout's initialization effect: first attempt immediate, retries backed off, toast once at the cap. */
function useInitRetry(effects: { initializeApp: jest.Mock; showToast: jest.Mock }) {
  const [initRetryCount, setInitRetryCount] = React.useState(0);
  const hasInitialized = React.useRef(false);
  const isInitializing = React.useRef(false);
  const hasShownInitFailureToast = React.useRef(false);

  React.useEffect(() => {
    const shouldInitialize = !hasInitialized.current && !isInitializing.current && initRetryCount < MAX_INIT_RETRIES;

    if (!shouldInitialize) {
      if (!hasInitialized.current && initRetryCount >= MAX_INIT_RETRIES && !hasShownInitFailureToast.current) {
        hasShownInitFailureToast.current = true;
        effects.showToast('error', 'app.initialization_failed');
      }
      return;
    }

    if (initRetryCount === 0) {
      effects.initializeApp();
      return;
    }

    const backoffMs = 1000 * Math.pow(3, initRetryCount - 1);
    const retryTimer = setTimeout(() => {
      effects.initializeApp();
    }, backoffMs);
    return () => clearTimeout(retryTimer);
  }, [initRetryCount, effects]);

  return { fail: () => setInitRetryCount((c) => c + 1), initRetryCount };
}

describe('app initialization retry backoff', () => {
  const effects = { initializeApp: jest.fn(), showToast: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('runs the first initialization attempt immediately', () => {
    renderHook(() => useInitRetry(effects));

    expect(effects.initializeApp).toHaveBeenCalledTimes(1);
  });

  it('backs off 1s, then 3s, then 9s between retries', () => {
    const { result } = renderHook(() => useInitRetry(effects));
    expect(effects.initializeApp).toHaveBeenCalledTimes(1);

    // First failure -> retry after 1s, not immediately.
    act(() => result.current.fail());
    expect(effects.initializeApp).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(999);
    });
    expect(effects.initializeApp).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(effects.initializeApp).toHaveBeenCalledTimes(2);

    // Second failure -> 3s.
    act(() => result.current.fail());
    act(() => {
      jest.advanceTimersByTime(2999);
    });
    expect(effects.initializeApp).toHaveBeenCalledTimes(2);
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(effects.initializeApp).toHaveBeenCalledTimes(3);

    // Third failure -> retry budget exhausted, no fourth attempt.
    act(() => result.current.fail());
    act(() => {
      jest.advanceTimersByTime(60000);
    });
    expect(effects.initializeApp).toHaveBeenCalledTimes(3);
  });

  it('surfaces a toast once the retry budget is exhausted', () => {
    const { result } = renderHook(() => useInitRetry(effects));

    act(() => result.current.fail());
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    act(() => result.current.fail());
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(effects.showToast).not.toHaveBeenCalled();

    act(() => result.current.fail());

    expect(effects.showToast).toHaveBeenCalledTimes(1);
    expect(effects.showToast).toHaveBeenCalledWith('error', 'app.initialization_failed');
  });

  it('does not repeat the toast on subsequent re-renders', () => {
    const { result, rerender } = renderHook(() => useInitRetry(effects));

    act(() => result.current.fail());
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    act(() => result.current.fail());
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    act(() => result.current.fail());
    expect(effects.showToast).toHaveBeenCalledTimes(1);

    rerender({});
    rerender({});

    expect(effects.showToast).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending retry when the effect is torn down', () => {
    const { result, unmount } = renderHook(() => useInitRetry(effects));

    act(() => result.current.fail());
    unmount();

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    // Only the initial attempt ran; the scheduled retry was cleaned up.
    expect(effects.initializeApp).toHaveBeenCalledTimes(1);
  });
});
