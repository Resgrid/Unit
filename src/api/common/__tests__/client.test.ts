const mockRequestInterceptorUse = jest.fn();
const mockResponseInterceptorUse = jest.fn();
const mockLoggerWarn = jest.fn();
const mockGetAuthState = jest.fn();
const mockAxiosInstance = Object.assign(jest.fn(), {
  defaults: {
    headers: {
      common: {},
    },
  },
  interceptors: {
    request: {
      use: mockRequestInterceptorUse,
    },
    response: {
      use: mockResponseInterceptorUse,
    },
  },
});

// Records the config the client passes to axios.create, so the assertions below
// survive both jest.isolateModules and the beforeEach clearAllMocks().
const mockCreateConfigs: Record<string, unknown>[] = [];

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn((config: Record<string, unknown>) => {
      mockCreateConfigs.push(config);
      return mockAxiosInstance;
    }),
  },
}));

jest.mock('@/lib/logging', () => ({
  logger: {
    warn: mockLoggerWarn,
  },
}));

jest.mock('@/lib/storage/app', () => ({
  getBaseApiUrl: jest.fn(() => 'https://example.test'),
}));

jest.mock('@/stores/auth/store', () => ({
  __esModule: true,
  default: {
    getState: mockGetAuthState,
  },
}));

let rejectResponse: (error: unknown) => Promise<unknown>;

describe('API client token refresh logging', () => {
  beforeAll(() => {
    jest.isolateModules(() => {
      require('@/api/common/client');
    });
    rejectResponse = mockResponseInterceptorUse.mock.calls[0]?.[1] as (error: unknown) => Promise<unknown>;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs the token refresh operation and original request trace ID when refresh fails', async () => {
    const refreshError = new Error('Token refresh failed');
    const refreshAccessToken = jest.fn().mockRejectedValue(refreshError);
    const getHeader = jest.fn((name: string) => (name === 'x-trace-id' ? 'trace-123' : undefined));

    mockGetAuthState.mockReturnValue({
      refreshAccessToken,
      refreshToken: 'refresh-token',
    });

    const requestError = {
      config: {
        headers: {
          get: getHeader,
        },
      },
      response: {
        status: 401,
      },
    };

    await expect(rejectResponse(requestError)).rejects.toBe(refreshError);

    expect(mockLoggerWarn).toHaveBeenCalledWith({
      message: 'Request failed after token refresh attempt',
      operation: 'token_refresh',
      trace_id: 'trace-123',
      context: { error: refreshError },
    });
    expect(getHeader).toHaveBeenCalledWith('x-trace-id');
  });

  it('configures a request timeout so a hung request cannot stall the refresh queue', () => {
    // Axios defaults to no timeout: a hung request would hold the single-flight
    // refresh promise and every 401-queued request behind it, indefinitely.
    expect(mockCreateConfigs[0]).toMatchObject({ timeout: 30000 });
  });
});
