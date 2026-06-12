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

  it('returns true when the request was sent but no response came back (no specific code)', () => {
    // request object present, no response, no ERR_NETWORK/ECONNABORTED code (e.g. socket hang up)
    const error = new AxiosError('socket hang up', undefined, undefined, {} as never);
    expect(isNetworkError(error)).toBe(true);
  });

  it('returns false for an Axios error with no response AND no request (setup/config error)', () => {
    // Failed before the request was ever sent — a client/setup bug, not transient
    // connectivity; it should surface as an error, not be classified as a network error.
    expect(isNetworkError(new AxiosError('Something failed'))).toBe(false);
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
