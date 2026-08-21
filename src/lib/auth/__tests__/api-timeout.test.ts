/**
 * The auth client talks to /connect/token. Without a timeout a hung request pins
 * the single-flight refresh promise (lib/auth/refresh-lock.ts) and every request
 * queued behind a 401 waits on it forever.
 */
const mockCreateConfigs: Record<string, unknown>[] = [];

const mockAuthApiInstance = Object.assign(jest.fn(), {
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
  post: jest.fn(),
});

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn((config: Record<string, unknown>) => {
      mockCreateConfigs.push(config);
      return mockAuthApiInstance;
    }),
  },
}));

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/lib/storage/app', () => ({
  getBaseApiUrl: jest.fn(() => 'https://example.test'),
}));

describe('auth API client configuration', () => {
  beforeAll(() => {
    jest.isolateModules(() => {
      require('@/lib/auth/api');
    });
  });

  it('sets a timeout on the token endpoint client', () => {
    expect(mockCreateConfigs[0]).toMatchObject({ timeout: 15000 });
  });

  it('keeps the timeout shorter than the main API client timeout', () => {
    // The refresh must give up before a request waiting on it would, so a stalled
    // refresh surfaces as a transient failure rather than cascading timeouts.
    expect(mockCreateConfigs[0].timeout as number).toBeLessThan(30000);
  });
});
