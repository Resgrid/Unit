import { getAllUnitStatuses } from '@/api/satuses/statuses';
import { getUnits } from '@/api/units/units';
import { useUnitsStore } from '@/stores/units/store';

jest.mock('@/api/units/units', () => ({
  getUnits: jest.fn(),
}));

jest.mock('@/api/satuses/statuses', () => ({
  getAllUnitStatuses: jest.fn(),
}));

jest.mock('@/lib/logging', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

const mockGetUnits = getUnits as jest.Mock;
const mockGetAllUnitStatuses = getAllUnitStatuses as jest.Mock;

/** A promise the test settles by hand, so two fetches can be in flight at once. */
const deferred = <T>() => {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

const UNIT_A = { UnitId: 'a', Name: 'Engine 1' };
const UNIT_B = { UnitId: 'b', Name: 'Engine 2' };

describe('useUnitsStore overlapping fetches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useUnitsStore.setState({ units: [], unitStatuses: [], isLoading: false, error: null, hasLoaded: false });
    mockGetAllUnitStatuses.mockResolvedValue({ Data: [] });
  });

  it('keeps the newer result when a slower earlier fetch lands last', async () => {
    const slow = deferred<{ Data: unknown[] }>();
    const fast = deferred<{ Data: unknown[] }>();
    mockGetUnits.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);

    const first = useUnitsStore.getState().fetchUnits();
    const second = useUnitsStore.getState().fetchUnits(true);

    fast.resolve({ Data: [UNIT_B] });
    await second;

    slow.resolve({ Data: [UNIT_A] });
    await first;

    expect(useUnitsStore.getState().units).toEqual([UNIT_B]);
    // The newest fetch owns isLoading, and it has already finished.
    expect(useUnitsStore.getState().isLoading).toBe(false);
    expect(useUnitsStore.getState().hasLoaded).toBe(true);
  });

  it('does not surface a superseded failure over the units a newer fetch delivered', async () => {
    const failing = deferred<{ Data: unknown[] }>();
    const succeeding = deferred<{ Data: unknown[] }>();
    mockGetUnits.mockReturnValueOnce(failing.promise).mockReturnValueOnce(succeeding.promise);

    const first = useUnitsStore.getState().fetchUnits();
    const second = useUnitsStore.getState().fetchUnits(true);

    succeeding.resolve({ Data: [UNIT_B] });
    await second;

    failing.reject(new Error('network down'));
    await first;

    expect(useUnitsStore.getState().error).toBeNull();
    expect(useUnitsStore.getState().units).toEqual([UNIT_B]);
  });

  it('records the result of a single fetch', async () => {
    mockGetUnits.mockResolvedValue({ Data: [UNIT_A] });
    mockGetAllUnitStatuses.mockResolvedValue({ Data: [{ UnitType: 'Engine' }] });

    await useUnitsStore.getState().fetchUnits();

    expect(useUnitsStore.getState().units).toEqual([UNIT_A]);
    expect(useUnitsStore.getState().unitStatuses).toEqual([{ UnitType: 'Engine' }]);
    expect(useUnitsStore.getState().isLoading).toBe(false);
    expect(useUnitsStore.getState().hasLoaded).toBe(true);
  });

  it('keeps a failure from the newest fetch', async () => {
    mockGetUnits.mockRejectedValue(new Error('network down'));

    await useUnitsStore.getState().fetchUnits();

    expect(useUnitsStore.getState().error).toBe('network down');
    expect(useUnitsStore.getState().isLoading).toBe(false);
    expect(useUnitsStore.getState().hasLoaded).toBe(true);
  });
});
