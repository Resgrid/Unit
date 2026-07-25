import { act, renderHook } from '@testing-library/react-native';

const mockCoreStoreGetState = jest.fn(() => ({ config: { EventingUrl: 'https://eventing.example.com/' } }));
const mockSecurityStore = { getState: jest.fn(() => ({ rights: { DepartmentId: '123' } })) };

jest.mock('@/services/signalr.service', () => {
  const mockInstance = {
    connectToHubWithEventingUrl: jest.fn().mockResolvedValue(undefined),
    disconnectFromHub: jest.fn().mockResolvedValue(undefined),
    invoke: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
  };
  class MockSignalRService {
    static readonly HUB_DISCONNECTED_EVENT = '__hubDisconnected';
    static readonly HUB_RECONNECTING_EVENT = '__hubReconnecting';
    static readonly HUB_RECONNECTED_EVENT = '__hubReconnected';
  }
  return { SignalRService: MockSignalRService, signalRService: mockInstance, default: mockInstance };
});
jest.mock('../../app/core-store', () => {
  const mockStore: any = () => mockCoreStoreGetState();
  mockStore.getState = () => mockCoreStoreGetState();
  return { useCoreStore: mockStore };
});
jest.mock('../../security/store', () => {
  console.log('RELATIVE security mock factory ran');
  return { securityStore: mockSecurityStore, useSecurityStore: mockSecurityStore };
});
jest.mock('@/stores/security/store', () => {
  console.log('ALIAS security mock factory ran');
  return { securityStore: mockSecurityStore };
});
jest.mock('@/lib/logging', () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), trace: jest.fn(), fatal: jest.fn() } }));
jest.mock('@/lib/env', () => ({ Env: { CHANNEL_HUB_NAME: 'eventingHub', REALTIME_GEO_HUB_NAME: 'geolocationHub' } }));
jest.mock('@/lib', () => ({ useAuthStore: { getState: jest.fn(() => ({ accessToken: 'mock-token' })) } }));

import { useSignalRStore } from '../signalr-store';
import { signalRService } from '@/services/signalr.service';

it('dbg join', async () => {
  const { result } = renderHook(() => useSignalRStore());
  await act(async () => {
    await result.current.connectUpdateHub();
  });
  console.log('error:', result.current.error);
  console.log('invoke calls:', (signalRService.invoke as jest.Mock).mock.calls);
});
