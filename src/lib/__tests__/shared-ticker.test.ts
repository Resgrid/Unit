import { getSharedTickerListenerCount, subscribeToSharedTicker } from '@/lib/shared-ticker';

describe('shared ticker', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports listener errors and keeps ticking other listeners', () => {
    jest.useFakeTimers();
    const error = new Error('tick failed');
    const onError = jest.fn();
    const healthyListener = jest.fn();
    const unsubscribeFailingListener = subscribeToSharedTicker(
      () => {
        throw error;
      },
      { onError }
    );
    const unsubscribeHealthyListener = subscribeToSharedTicker(healthyListener, { onError: jest.fn() });

    jest.advanceTimersByTime(1000);

    expect(onError).toHaveBeenCalledWith(error);
    expect(healthyListener).toHaveBeenCalledTimes(1);

    unsubscribeFailingListener();
    unsubscribeHealthyListener();
    expect(getSharedTickerListenerCount()).toBe(0);
  });
});
