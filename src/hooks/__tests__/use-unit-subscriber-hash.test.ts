import { renderHook, waitFor } from '@testing-library/react-native';

import { getUnitSubscriberHash } from '@/api/novu/inbox';

import { useUnitSubscriberHash } from '../use-unit-subscriber-hash';

jest.mock('@/api/novu/inbox', () => ({
  getUnitSubscriberHash: jest.fn(),
}));

jest.mock('@/lib/logging', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockGetUnitSubscriberHash = getUnitSubscriberHash as jest.MockedFunction<typeof getUnitSubscriberHash>;

describe('useUnitSubscriberHash', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('settles with the server-issued hash for the active unit', async () => {
    mockGetUnitSubscriberHash.mockResolvedValue({ Data: { UnitId: '15', SubscriberHash: 'unit-15-hash' } });

    const { result } = renderHook(() => useUnitSubscriberHash('15'));

    expect(result.current.settled).toBe(false);
    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.subscriberHash).toBe('unit-15-hash');
    expect(mockGetUnitSubscriberHash).toHaveBeenCalledWith('15');
  });

  // An older server has no such endpoint, and until Novu enforces HMAC the inbox still opens without a hash.
  it('settles without a hash when the fetch fails', async () => {
    mockGetUnitSubscriberHash.mockRejectedValue(new Error('404'));

    const { result } = renderHook(() => useUnitSubscriberHash('15'));

    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.subscriberHash).toBeUndefined();
  });

  it('does not report the previous unit as settled after a unit switch', async () => {
    let resolveSecond: (value: { Data: { UnitId: string; SubscriberHash: string } }) => void = () => {};
    mockGetUnitSubscriberHash
      .mockResolvedValueOnce({ Data: { UnitId: '15', SubscriberHash: 'unit-15-hash' } })
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)));

    const { result, rerender } = renderHook(({ unitId }) => useUnitSubscriberHash(unitId), { initialProps: { unitId: '15' } });
    await waitFor(() => expect(result.current.settled).toBe(true));

    rerender({ unitId: '16' });

    expect(result.current.settled).toBe(false);
    expect(result.current.subscriberHash).toBeUndefined();

    resolveSecond({ Data: { UnitId: '16', SubscriberHash: 'unit-16-hash' } });
    await waitFor(() => expect(result.current.subscriberHash).toBe('unit-16-hash'));
  });

  it('does nothing without an active unit', () => {
    const { result } = renderHook(() => useUnitSubscriberHash(null));

    expect(result.current.settled).toBe(false);
    expect(mockGetUnitSubscriberHash).not.toHaveBeenCalled();
  });
});
