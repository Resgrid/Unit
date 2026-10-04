jest.mock('@/api/common/client', () => ({ createApiEndpoint: jest.fn(() => ({ post: jest.fn() })) }));

import { createApiEndpoint } from '@/api/common/client';
import { registerUnitDevice, unRegisterWebPush } from '@/api/devices/push';

const [registerEndpoint, unregisterEndpoint] = (createApiEndpoint as jest.Mock).mock.results.map((result) => result.value as { post: jest.Mock });

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
});
