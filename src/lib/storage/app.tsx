import { Env } from '@env';

import { getItem, removeItem, setItem } from '@/lib/storage';

const BASE_URL = 'baseUrl';
const ACTIVE_UNIT_ID = 'activeUnitId';
const ACTIVE_CALL_ID = 'activeCallId';

export const removeBaseApiUrl = () => removeItem(BASE_URL);
export const setBaseApiUrl = (value: string) =>
  setItem<string>(BASE_URL, value);

export const getBaseApiUrl = () => {
  const baseUrl = getItem<string>(BASE_URL);
  if (!baseUrl) {
    return `${Env.BASE_API_URL}/api/${Env.API_VERSION}`;
  }
  return baseUrl;
};

export const removeActiveUnitId = () => removeItem(ACTIVE_UNIT_ID);
export const setActiveUnitId = (value: string) =>
  setItem<string>(ACTIVE_UNIT_ID, value);

export const getActiveUnitId = () => {
  const activeUnitId = getItem<string>(ACTIVE_UNIT_ID);
  if (!activeUnitId) {
    return activeUnitId;
  }
  return '';
};

export const removeActiveCallId = () => removeItem(ACTIVE_CALL_ID);
export const setActiveCallId = (value: string) =>
  setItem<string>(ACTIVE_CALL_ID, value);

export const getActiveCallId = () => {
  const activeCallId = getItem<string>(ACTIVE_CALL_ID);
  if (!activeCallId) {
    return activeCallId;
  }
  return '';
};
