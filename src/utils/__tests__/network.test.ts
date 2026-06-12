import { describe, expect, it } from '@jest/globals';
import { AxiosError } from 'axios';

import { isNetworkError } from '../network';

describe('isNetworkError', () => {
  it('returns true for an Axios network error (no response received)', () => {
    expect(isNetworkError(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe(true);
  });

  it('returns true for an Axios timeout error', () => {
    expect(isNetworkError(new AxiosError('timeout of 0ms exceeded', 'ECONNABORTED'))).toBe(true);
  });

  it('returns true for any Axios error without a response object', () => {
    expect(isNetworkError(new AxiosError('Something failed'))).toBe(true);
  });

  it('returns false for an Axios error that received a server response (4xx/5xx)', () => {
    const response = {
      status: 500,
      statusText: 'Internal Server Error',
      data: {},
      headers: {},
      config: {} as never,
    };
    const error = new AxiosError('Request failed with status code 500', 'ERR_BAD_RESPONSE', undefined, undefined, response as never);
    expect(isNetworkError(error)).toBe(false);
  });

  it('returns false for a plain (non-Axios) Error', () => {
    expect(isNetworkError(new Error('boom'))).toBe(false);
  });

  it('returns false for non-error values', () => {
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
    expect(isNetworkError('Network Error')).toBe(false);
    expect(isNetworkError({ message: 'Network Error' })).toBe(false);
  });
});
