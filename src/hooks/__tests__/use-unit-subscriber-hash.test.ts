import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AxiosError, type AxiosResponse } from 'axios';

import { getUnitSubscriberHash } from '@/api/novu/inbox';

import { SUBSCRIBER_HASH_ATTEMPTS_BEFORE_SETTLING, SUBSCRIBER_HASH_RETRY_BASE_DELAY_MS, SUBSCRIBER_HASH_RETRY_MAX_DELAY_MS, useUnitSubscriberHash } from '../use-unit-subscriber-hash';

jest.mock('@/api/novu/inbox', () => ({
  getUnitSubscriberHash: jest.fn(),
}));

jest.mock('@/lib/logging', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockGetUnitSubscriberHash = getUnitSubscriberHash as jest.MockedFunction<typeof getUnitSubscriberHash>;

const httpError = (status: number): AxiosError => {
  const response = { status, statusText: '', data: {}, headers: {}, config: {} as never } as AxiosResponse;
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, response);
};

const networkError = (): AxiosError => new AxiosError('Network Error', 'ERR_NETWORK');

const hashFor = (unitId: string) => ({ Data: { UnitId: unitId, SubscriberHash: `unit-${unitId}-hash` } });

describe('useUnitSubscriberHash', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('settles with the server-issued hash for the active unit', async () => {
    mockGetUnitSubscriberHash.mockResolvedValue(hashFor('15'));

    const { result, unmount } = renderHook(() => useUnitSubscriberHash('15'));

    expect(result.current.settled).toBe(false);
    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.subscriberHash).toBe('unit-15-hash');
    expect(mockGetUnitSubscriberHash).toHaveBeenCalledWith('15');
    unmount();
  });

  // An older server has no such endpoint, and until Novu enforces HMAC the inbox still opens without a hash.
  it('settles without a hash, and does not retry, when the server has no such endpoint', async () => {
    mockGetUnitSubscriberHash.mockRejectedValue(httpError(404));

    const { result, unmount } = renderHook(() => useUnitSubscriberHash('15'));

    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.subscriberHash).toBeUndefined();
    expect(mockGetUnitSubscriberHash).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('does not report the previous unit as settled after a unit switch', async () => {
    let resolveSecond: (value: { Data: { UnitId: string; SubscriberHash: string } }) => void = () => {};
    mockGetUnitSubscriberHash.mockResolvedValueOnce(hashFor('15')).mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)));

    const { result, rerender, unmount } = renderHook(({ unitId }) => useUnitSubscriberHash(unitId), { initialProps: { unitId: '15' } });
    await waitFor(() => expect(result.current.settled).toBe(true));

    rerender({ unitId: '16' });

    expect(result.current.settled).toBe(false);
    expect(result.current.subscriberHash).toBeUndefined();

    resolveSecond(hashFor('16'));
    await waitFor(() => expect(result.current.subscriberHash).toBe('unit-16-hash'));
    unmount();
  });

  it('does nothing without an active unit', () => {
    const { result, unmount } = renderHook(() => useUnitSubscriberHash(null));

    expect(result.current.settled).toBe(false);
    expect(mockGetUnitSubscriberHash).not.toHaveBeenCalled();
    unmount();
  });

  describe('a lookup that fails without an answer', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const flush = async () => {
      await act(async () => {
        await Promise.resolve();
      });
    };

    const advance = async (ms: number) => {
      await act(async () => {
        jest.advanceTimersByTime(ms);
      });
      await flush();
    };

    it('retries before settling, so a passing outage still opens the inbox with its hash', async () => {
      mockGetUnitSubscriberHash.mockRejectedValueOnce(networkError()).mockResolvedValueOnce(hashFor('15'));

      const { result, unmount } = renderHook(() => useUnitSubscriberHash('15'));
      await flush();

      expect(result.current.settled).toBe(false);
      expect(mockGetUnitSubscriberHash).toHaveBeenCalledTimes(1);

      await advance(SUBSCRIBER_HASH_RETRY_BASE_DELAY_MS);

      expect(mockGetUnitSubscriberHash).toHaveBeenCalledTimes(2);
      expect(result.current.settled).toBe(true);
      expect(result.current.subscriberHash).toBe('unit-15-hash');
      unmount();
    });

    it('retries a server error the same way', async () => {
      mockGetUnitSubscriberHash.mockRejectedValueOnce(httpError(503)).mockResolvedValueOnce(hashFor('15'));

      const { result, unmount } = renderHook(() => useUnitSubscriberHash('15'));
      await flush();
      expect(result.current.settled).toBe(false);

      await advance(SUBSCRIBER_HASH_RETRY_BASE_DELAY_MS);

      expect(result.current.subscriberHash).toBe('unit-15-hash');
      unmount();
    });

    it('settles without a hash after a few attempts, then hands over a hash that arrives later', async () => {
      mockGetUnitSubscriberHash.mockRejectedValue(networkError());

      const { result, unmount } = renderHook(() => useUnitSubscriberHash('15'));
      await flush();

      // Backoff doubles: 2s, 4s, ...
      for (let failures = 1; failures < SUBSCRIBER_HASH_ATTEMPTS_BEFORE_SETTLING; failures++) {
        expect(result.current.settled).toBe(false);
        await advance(SUBSCRIBER_HASH_RETRY_BASE_DELAY_MS * 2 ** (failures - 1));
      }

      expect(mockGetUnitSubscriberHash).toHaveBeenCalledTimes(SUBSCRIBER_HASH_ATTEMPTS_BEFORE_SETTLING);
      expect(result.current.settled).toBe(true);
      expect(result.current.subscriberHash).toBeUndefined();

      mockGetUnitSubscriberHash.mockResolvedValueOnce(hashFor('15'));
      await advance(SUBSCRIBER_HASH_RETRY_BASE_DELAY_MS * 2 ** (SUBSCRIBER_HASH_ATTEMPTS_BEFORE_SETTLING - 1));

      expect(mockGetUnitSubscriberHash).toHaveBeenCalledTimes(SUBSCRIBER_HASH_ATTEMPTS_BEFORE_SETTLING + 1);
      expect(result.current.settled).toBe(true);
      expect(result.current.subscriberHash).toBe('unit-15-hash');
      unmount();
    });

    it('caps the backoff', async () => {
      mockGetUnitSubscriberHash.mockRejectedValue(networkError());

      const { unmount } = renderHook(() => useUnitSubscriberHash('15'));
      await flush();

      // Run until the doubling delay passes the cap.
      let delay = SUBSCRIBER_HASH_RETRY_BASE_DELAY_MS;
      while (delay < SUBSCRIBER_HASH_RETRY_MAX_DELAY_MS) {
        await advance(delay);
        delay *= 2;
      }
      const calls = mockGetUnitSubscriberHash.mock.calls.length;

      await advance(SUBSCRIBER_HASH_RETRY_MAX_DELAY_MS);

      expect(mockGetUnitSubscriberHash).toHaveBeenCalledTimes(calls + 1);
      unmount();
    });

    it('stops retrying when the unit changes or the hook unmounts', async () => {
      mockGetUnitSubscriberHash.mockRejectedValue(networkError());

      const { rerender, unmount } = renderHook(({ unitId }) => useUnitSubscriberHash(unitId), { initialProps: { unitId: '15' } });
      await flush();

      mockGetUnitSubscriberHash.mockResolvedValue(hashFor('16'));
      rerender({ unitId: '16' });
      await flush();
      await advance(SUBSCRIBER_HASH_RETRY_MAX_DELAY_MS);

      expect(mockGetUnitSubscriberHash.mock.calls.map(([unitId]) => unitId)).toEqual(['15', '16']);

      mockGetUnitSubscriberHash.mockRejectedValue(networkError());
      rerender({ unitId: '17' });
      await flush();
      unmount();
      await advance(SUBSCRIBER_HASH_RETRY_MAX_DELAY_MS);

      expect(mockGetUnitSubscriberHash.mock.calls.map(([unitId]) => unitId)).toEqual(['15', '16', '17']);
    });
  });
});
