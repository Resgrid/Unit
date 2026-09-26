import { Env } from '@env';

import { getItem, removeItem, setItem } from '@/lib/storage';

export const BASE_API_URL_STORAGE_KEY = 'baseUrl';
const ACTIVE_UNIT_ID = 'activeUnitId';
const ACTIVE_CALL_ID = 'activeCallId';
const DEVICE_UUID = 'unitDeviceUuid';

export const removeBaseApiUrl = () => removeItem(BASE_API_URL_STORAGE_KEY);
export const setBaseApiUrl = (value: string) => setItem<string>(BASE_API_URL_STORAGE_KEY, value);

export const getBaseApiUrl = () => {
  const baseUrl = getItem<string>(BASE_API_URL_STORAGE_KEY);
  if (!baseUrl) {
    return `${Env.BASE_API_URL}/api/${Env.API_VERSION}`;
  }
  return baseUrl;
};

export const removeActiveUnitId = () => removeItem(ACTIVE_UNIT_ID);
export const setActiveUnitId = (value: string) => setItem<string>(ACTIVE_UNIT_ID, value);

/** The unit the crew last selected, restored on launch by the core store's init. */
export const getActiveUnitId = (): string | null => getItem<string>(ACTIVE_UNIT_ID) || null;

export const removeActiveCallId = () => removeItem(ACTIVE_CALL_ID);
export const setActiveCallId = (value: string) => setItem<string>(ACTIVE_CALL_ID, value);

/** The call the crew last made active, restored on launch by the core store's init. */
export const getActiveCallId = (): string | null => getItem<string>(ACTIVE_CALL_ID) || null;

export const removeDeviceUuid = () => removeItem(DEVICE_UUID);
export const setDeviceUuid = (value: string) => setItem<string>(DEVICE_UUID, value);

export const getDeviceUuid = () => {
  const uuid = getItem<string>(DEVICE_UUID);
  return uuid;
};
