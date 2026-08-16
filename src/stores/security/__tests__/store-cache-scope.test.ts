import { type DepartmentRightsResultData } from '@/models/v4/security/departmentRightsResultData';

const mockCacheClear = jest.fn();
const mockSetCacheScope = jest.fn();

jest.mock('@/api/security/security', () => ({
  getCurrentUsersRights: jest.fn(),
}));

jest.mock('@/lib/cache/cache-manager', () => ({
  cacheManager: {
    clear: mockCacheClear,
  },
}));

jest.mock('@/lib/cache/cache-scope', () => ({
  setCacheScope: mockSetCacheScope,
}));

jest.mock('@/lib/storage', () => ({
  zustandStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

type SecurityStore = {
  setState: (state: { rights: DepartmentRightsResultData | null }) => void;
};

let securityStore: SecurityStore;

const rightsFor = (departmentId: string, overrides: Partial<DepartmentRightsResultData> = {}): DepartmentRightsResultData =>
  ({
    DepartmentId: departmentId,
    DepartmentName: 'Test Department',
    DepartmentCode: 'TEST',
    IsAdmin: false,
    Groups: [],
    ...overrides,
  }) as DepartmentRightsResultData;

describe('security store API cache scoping', () => {
  beforeAll(() => {
    // Required lazily so the mock factories above see initialized mock functions.
    securityStore = require('../store').securityStore;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    securityStore.setState({ rights: null });
    jest.clearAllMocks();
  });

  it('clears the cache and rescopes when the user moves to another department', () => {
    securityStore.setState({ rights: rightsFor('dept-1') });
    jest.clearAllMocks();

    securityStore.setState({ rights: rightsFor('dept-2') });

    expect(mockCacheClear).toHaveBeenCalledTimes(1);
    expect(mockSetCacheScope).toHaveBeenCalledWith({ departmentId: 'dept-2' });
  });

  it('scopes the first rights load without discarding what startup just fetched', () => {
    securityStore.setState({ rights: rightsFor('dept-1') });

    expect(mockCacheClear).not.toHaveBeenCalled();
    expect(mockSetCacheScope).toHaveBeenCalledWith({ departmentId: 'dept-1' });
  });

  it('drops the department from the scope when rights are reset on sign-out', () => {
    securityStore.setState({ rights: rightsFor('dept-1') });
    jest.clearAllMocks();

    securityStore.setState({ rights: null });

    expect(mockCacheClear).toHaveBeenCalledTimes(1);
    expect(mockSetCacheScope).toHaveBeenCalledWith({ departmentId: null });
  });

  it('leaves the cache alone when rights change but the department does not', () => {
    securityStore.setState({ rights: rightsFor('dept-1') });
    jest.clearAllMocks();

    securityStore.setState({ rights: rightsFor('dept-1', { IsAdmin: true }) });

    expect(mockCacheClear).not.toHaveBeenCalled();
    expect(mockSetCacheScope).not.toHaveBeenCalled();
  });

  it('still moves the scope when clearing the cache fails', () => {
    securityStore.setState({ rights: rightsFor('dept-1') });
    jest.clearAllMocks();
    mockCacheClear.mockImplementationOnce(() => {
      throw new Error('storage unavailable');
    });

    securityStore.setState({ rights: rightsFor('dept-2') });

    expect(mockSetCacheScope).toHaveBeenCalledWith({ departmentId: 'dept-2' });
  });

  it('treats a blank department id as no department', () => {
    securityStore.setState({ rights: rightsFor('') });

    expect(mockSetCacheScope).not.toHaveBeenCalled();
  });
});
