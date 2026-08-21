import { act, renderHook } from '@testing-library/react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { logger } from '@/lib/logging';

import { loadKeepAliveState, useKeepAlive } from '../use-keep-alive';
import { storage } from '../../storage';

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(),
  deactivateKeepAwake: jest.fn(),
}));

jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('react-native-mmkv', () => ({
  useMMKVBoolean: jest.fn(() => [false, jest.fn()]),
  MMKV: jest.fn().mockImplementation(() => ({
    getBoolean: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}));

jest.mock('../../storage', () => ({
  storage: {
    getBoolean: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockActivate = activateKeepAwakeAsync as jest.MockedFunction<typeof activateKeepAwakeAsync>;
const mockDeactivate = deactivateKeepAwake as jest.MockedFunction<typeof deactivateKeepAwake>;
const mockStorage = storage as jest.Mocked<typeof storage>;

describe('useKeepAlive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActivate.mockResolvedValue(undefined as never);
  });

  it('activates keep awake when enabled', async () => {
    const { result } = renderHook(() => useKeepAlive());

    await act(async () => {
      await result.current.setKeepAliveEnabled(true);
    });

    expect(mockActivate).toHaveBeenCalledWith('settings');
  });

  it('deactivates keep awake when disabled', async () => {
    const { result } = renderHook(() => useKeepAlive());

    await act(async () => {
      await result.current.setKeepAliveEnabled(false);
    });

    expect(mockDeactivate).toHaveBeenCalledWith('settings');
  });

  it('reports a failure through the logger rather than console', async () => {
    const failure = new Error('keep awake unavailable');
    mockActivate.mockRejectedValue(failure);

    const { result } = renderHook(() => useKeepAlive());

    await act(async () => {
      await result.current.setKeepAliveEnabled(true);
    });

    expect(logger.error).toHaveBeenCalledWith({
      message: 'Failed to update keep alive state',
      context: { error: failure, enabled: true },
    });
  });
});

describe('loadKeepAliveState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActivate.mockResolvedValue(undefined as never);
  });

  it('activates keep awake when the persisted flag is set', async () => {
    mockStorage.getBoolean.mockReturnValue(true);

    await loadKeepAliveState();

    expect(mockActivate).toHaveBeenCalledWith('settings');
  });

  it('does nothing when the persisted flag is unset', async () => {
    mockStorage.getBoolean.mockReturnValue(false);

    await loadKeepAliveState();

    expect(mockActivate).not.toHaveBeenCalled();
  });

  it('reports a startup failure through the logger rather than console', async () => {
    const failure = new Error('storage unavailable');
    mockStorage.getBoolean.mockImplementation(() => {
      throw failure;
    });

    await loadKeepAliveState();

    expect(logger.error).toHaveBeenCalledWith({
      message: 'Failed to load keep alive state on startup',
      context: { error: failure },
    });
  });
});
