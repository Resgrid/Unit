const mockValues = new Map<string, boolean>();
const mockMMKVConstructor = jest.fn();

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation((...args: unknown[]) => mockMMKVConstructor(...args)),
}));

jest.mock('../index', () => ({
  storage: {
    getBoolean: jest.fn((key: string) => mockValues.get(key)),
    set: jest.fn((key: string, value: boolean) => {
      mockValues.set(key, value);
    }),
  },
}));

jest.mock('../../logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { storage } from '../index';
import { getBackgroundGeolocationStorageKey, loadBackgroundGeolocationState, saveBackgroundGeolocationState } from '../background-geolocation';

describe('background geolocation storage', () => {
  beforeEach(() => {
    mockValues.clear();
  });

  // A second MMKV instance on the main store id with a different encryption key could open (and encrypt) the whole
  // store with the wrong key, so the setting lives in the app's one shared instance.
  it('never opens its own MMKV instance', () => {
    expect(mockMMKVConstructor).not.toHaveBeenCalled();
  });

  it('saves to and loads from the shared storage instance', async () => {
    saveBackgroundGeolocationState(true);

    expect(storage.set).toHaveBeenCalledWith(getBackgroundGeolocationStorageKey(), true);
    expect(await loadBackgroundGeolocationState()).toBe(true);
  });

  it('defaults to disabled when nothing was saved', async () => {
    expect(await loadBackgroundGeolocationState()).toBe(false);
  });
});
