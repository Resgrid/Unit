import { createCall, updateCall } from '../calls';

jest.mock('../../common/client', () => {
  const post = jest.fn();
  const put = jest.fn();
  return {
    createApiEndpoint: jest.fn(() => ({ get: jest.fn(), post, put, delete: jest.fn() })),
    __mockPost: post,
    __mockPut: put,
  };
});

jest.mock('../../common/cached-client', () => ({
  createCachedApiEndpoint: jest.fn(() => ({ get: jest.fn() })),
}));

jest.mock('@/lib/cache/cache-manager', () => ({
  cacheManager: { remove: jest.fn() },
}));

jest.mock('@/lib/logging', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const { __mockPost: mockPost, __mockPut: mockPut } = jest.requireMock('../../common/client') as { __mockPost: jest.Mock; __mockPut: jest.Mock };

const base = { name: 'Structure fire', nature: 'Smoke showing', priority: 1, type: 'Fire' };

describe('call save payloads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue({ data: {} });
    mockPut.mockResolvedValue({ data: {} });
  });

  describe('createCall', () => {
    it('sends the reporter details and call identifiers', async () => {
      await createCall({ ...base, contactName: 'Jo Caller', contactInfo: '555-0100', externalId: 'CAD-1', incidentId: 'INC-7', referenceId: 'R-9' });

      expect(mockPost).toHaveBeenCalledWith(
        expect.objectContaining({ ContactName: 'Jo Caller', ContactInfo: '555-0100', ExternalId: 'CAD-1', IncidentId: 'INC-7', ReferenceId: 'R-9' })
      );
    });

    it('sends the scheduled dispatch time only when one is set', async () => {
      await createCall({ ...base, dispatchOnUtc: '2026-10-09T14:30:00.000Z' });
      expect(mockPost).toHaveBeenLastCalledWith(expect.objectContaining({ DispatchOnUtc: '2026-10-09T14:30:00.000Z' }));

      await createCall({ ...base });
      expect(mockPost.mock.calls[1][0]).not.toHaveProperty('DispatchOnUtc');

      await createCall({ ...base, dispatchOnUtc: '' });
      expect(mockPost.mock.calls[2][0]).not.toHaveProperty('DispatchOnUtc');
    });
  });

  describe('updateCall', () => {
    it('sends the call identifiers, blank meaning "keep what is stored"', async () => {
      await updateCall({ ...base, callId: '42', externalId: 'CAD-1' });

      expect(mockPut).toHaveBeenCalledWith(expect.objectContaining({ Id: '42', ExternalId: 'CAD-1', IncidentId: '', ReferenceId: '' }));
    });

    it('sends the scheduled dispatch time only when one is set, so leaving it out keeps the schedule', async () => {
      await updateCall({ ...base, callId: '42', dispatchOnUtc: '2026-10-09T14:30:00.000Z' });
      expect(mockPut).toHaveBeenLastCalledWith(expect.objectContaining({ DispatchOnUtc: '2026-10-09T14:30:00.000Z' }));

      await updateCall({ ...base, callId: '42' });
      expect(mockPut.mock.calls[1][0]).not.toHaveProperty('DispatchOnUtc');
    });
  });
});
