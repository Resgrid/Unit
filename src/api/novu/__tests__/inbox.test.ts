import { deleteMessage, getUnitSubscriberHash } from '../inbox';

jest.mock('../../common/client', () => {
  const del = jest.fn();
  const get = jest.fn();
  return {
    createApiEndpoint: jest.fn(() => ({ get, post: jest.fn(), put: jest.fn(), delete: del })),
    __mockDelete: del,
    __mockGet: get,
  };
});

const { __mockDelete: mockDelete, __mockGet: mockGet } = jest.requireMock('../../common/client') as { __mockDelete: jest.Mock; __mockGet: jest.Mock };

describe('inbox deleteMessage api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDelete.mockResolvedValue({ data: undefined });
  });

  // The server only deletes from an inbox the caller owns; the Unit app's inbox is the active unit's, so
  // without the unit it looks in the user's own inbox and answers 404.
  it('sends the active unit so the server deletes from the unit inbox', async () => {
    await deleteMessage('66f1c2a9e4b0a1b2c3d4e5f6', '15298');

    expect(mockDelete).toHaveBeenCalledWith({ messageId: '66f1c2a9e4b0a1b2c3d4e5f6', unitId: '15298' });
  });

  it('leaves unitId out when there is no active unit', async () => {
    await deleteMessage('66f1c2a9e4b0a1b2c3d4e5f6', null);

    expect(mockDelete).toHaveBeenCalledWith({ messageId: '66f1c2a9e4b0a1b2c3d4e5f6' });
  });
});

describe('inbox getUnitSubscriberHash api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('asks for the unit inbox hash and returns the response body', async () => {
    mockGet.mockResolvedValue({ data: { Data: { UnitId: '15298', SubscriberHash: 'abc123' } } });

    const result = await getUnitSubscriberHash('15298');

    expect(mockGet).toHaveBeenCalledWith({ unitId: '15298' });
    expect(result.Data.SubscriberHash).toBe('abc123');
  });
});
