jest.mock('@env', () => ({ Env: { BASE_API_URL: 'https://api.example.com', API_VERSION: 'v4' } }));

const mockStore = new Map<string, unknown>();
jest.mock('@/lib/storage', () => ({
  getItem: jest.fn((key: string) => (mockStore.has(key) ? mockStore.get(key) : null)),
  setItem: jest.fn(async (key: string, value: unknown) => {
    mockStore.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

import { getActiveCallId, getActiveUnitId, removeActiveCallId, removeActiveUnitId, setActiveCallId, setActiveUnitId } from '../app';

// The core store's init() restores the crew's unit and call from these on every launch.
describe('active unit and call persistence', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it('returns the unit id that was saved', async () => {
    await setActiveUnitId('unit-42');

    expect(getActiveUnitId()).toBe('unit-42');
  });

  it('returns null when no unit has been saved or it was removed', async () => {
    expect(getActiveUnitId()).toBeNull();

    await setActiveUnitId('unit-42');
    await removeActiveUnitId();

    expect(getActiveUnitId()).toBeNull();
  });

  it('returns the call id that was saved', async () => {
    await setActiveCallId('call-7');

    expect(getActiveCallId()).toBe('call-7');
  });

  it('returns null when no call has been saved or it was removed', async () => {
    expect(getActiveCallId()).toBeNull();

    await setActiveCallId('call-7');
    await removeActiveCallId();

    expect(getActiveCallId()).toBeNull();
  });
});
