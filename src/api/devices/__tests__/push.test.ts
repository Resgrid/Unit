jest.mock('@/api/common/client', () => ({ createApiEndpoint: jest.fn(() => ({ post: jest.fn() })) }));

import { createApiEndpoint } from '@/api/common/client';
import { registerUnitDevice, unRegisterNativePush, unRegisterWebPush } from '@/api/devices/push';

const [registerEndpoint, unregisterEndpoint, unregisterNativeEndpoint] = (createApiEndpoint as jest.Mock).mock.results.map((result) => result.value as { post: jest.Mock });
const endpointPaths = (createApiEndpoint as jest.Mock).mock.calls.map(([path]) => path as string);

describe('web push requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards cancellation to the device registration endpoint', async () => {
    const controller = new AbortController();
    const input = { UnitId: '12', Token: 'token', Platform: 3, DeviceUuid: 'device', Prefix: 'DEPT' };
    const response = { Data: null };
    registerEndpoint.post.mockResolvedValueOnce({ data: response });

    await expect(registerUnitDevice(input, controller.signal)).resolves.toBe(response);

    expect(registerEndpoint.post).toHaveBeenCalledWith(input, controller.signal);
  });

  it('forwards cancellation to the web push unregistration endpoint', async () => {
    const controller = new AbortController();
    const input = { UnitId: '12', Token: 'token', Prefix: 'DEPT' };
    const response = { Data: null };
    unregisterEndpoint.post.mockResolvedValueOnce({ data: response });

    await expect(unRegisterWebPush(input, controller.signal)).resolves.toBe(response);

    expect(unregisterEndpoint.post).toHaveBeenCalledWith(input, controller.signal);
  });

  it('sends a native token to the native push unregistration endpoint', async () => {
    const input = { UnitId: '12', Token: 'native-token', Prefix: 'DEPT' };
    const response = { Status: 'success' };
    unregisterNativeEndpoint.post.mockResolvedValueOnce({ data: response });

    await expect(unRegisterNativePush(input)).resolves.toBe(response);

    expect(endpointPaths[2]).toBe('/Devices/UnRegisterNativePush');
    expect(unregisterNativeEndpoint.post).toHaveBeenCalledWith(input, undefined);
  });
});
