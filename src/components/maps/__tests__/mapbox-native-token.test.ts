const mockSetAccessToken = jest.fn();

jest.mock('@rnmapbox/maps', () => ({
  __esModule: true,
  default: {
    setAccessToken: (token: string) => mockSetAccessToken(token),
  },
}));

jest.mock('@/lib/mapbox-token', () => ({
  onMapboxAccessTokenChange: jest.fn((listener: (token: string) => void) => {
    listener('pk.current.signature');
    return jest.fn();
  }),
}));

jest.mock('@/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('mapbox.native token sync', () => {
  beforeEach(() => {
    jest.resetModules();
    mockSetAccessToken.mockReset();
  });

  it('hands the token in use to the SDK when the module loads', async () => {
    mockSetAccessToken.mockResolvedValue('pk.current.signature');

    require('../mapbox.native');
    await flushPromises();

    expect(mockSetAccessToken).toHaveBeenCalledWith('pk.current.signature');
    expect(jest.requireMock('@/lib/logging').logger.error).not.toHaveBeenCalled();
  });

  it('logs a failed SDK token update instead of leaving the rejection unhandled', async () => {
    const failure = new Error('native module unavailable');
    mockSetAccessToken.mockRejectedValue(failure);

    require('../mapbox.native');
    await flushPromises();

    expect(jest.requireMock('@/lib/logging').logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to set the Mapbox access token',
        context: { error: failure },
      })
    );
  });
});
