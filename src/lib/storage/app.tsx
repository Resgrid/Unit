import { Env } from '@env';
import { randomUUID } from 'expo-crypto';

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

/**
 * The device id sent with every push registration, minted on first use. Sign-out wipes it so the next session
 * gets a fresh one, but sign-in does not restart the app: reading it with getDeviceUuid() after an in-app sign-out
 * (which every server switch from Settings is) registered the device with an empty id.
 */
export const getOrCreateDeviceUuid = (): string => {
  const existing = getDeviceUuid();
  if (existing) {
    return existing;
  }

  const uuid = randomUUID();
  setDeviceUuid(uuid);
  return uuid;
};
