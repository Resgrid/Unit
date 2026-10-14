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

import { getActiveCallId, getActiveUnitId, getDeviceUuid, getOrCreateDeviceUuid, removeActiveCallId, removeActiveUnitId, removeDeviceUuid, setActiveCallId, setActiveUnitId, setDeviceUuid } from '../app';

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

// Every push registration carries this id. Sign-out wipes it, and signing in again does not restart the app.
describe('device uuid', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it('keeps the id the device already has', async () => {
    await setDeviceUuid('existing-uuid');

    expect(getOrCreateDeviceUuid()).toBe('existing-uuid');
  });

  it('mints and saves a new id once sign-out has removed it', async () => {
    await setDeviceUuid('previous-session-uuid');
    await removeDeviceUuid();

    const uuid = getOrCreateDeviceUuid();

    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuid).not.toBe('previous-session-uuid');
    expect(getDeviceUuid()).toBe(uuid);
    expect(getOrCreateDeviceUuid()).toBe(uuid);
  });
});
