import { createApiEndpoint } from '@/api/common/client';
import { type PushRegistrationResult } from '@/models/v4/device/pushRegistrationResult';
import { type PushRegistrationUnitInput } from '@/models/v4/device/pushRegistrationUnitInput';
import { type WebPushUnRegistrationInput } from '@/models/v4/device/webPushUnRegistrationInput';

const registerUnitDeviceApi = createApiEndpoint('/Devices/RegisterUnitDevice');
const unRegisterWebPushApi = createApiEndpoint('/Devices/UnRegisterWebPush');

export const registerUnitDevice = async (data: PushRegistrationUnitInput, signal?: AbortSignal) => {
  const response = await registerUnitDeviceApi.post<PushRegistrationResult>({ ...data }, signal);
  return response.data;
};

export const unRegisterWebPush = async (data: WebPushUnRegistrationInput, signal?: AbortSignal) => {
  const response = await unRegisterWebPushApi.post<PushRegistrationResult>({ ...data }, signal);
  return response.data;
};
