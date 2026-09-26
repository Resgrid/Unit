import { useContactPreplanStore } from '@/stores/contacts/preplan-store';

jest.mock('@/api/contacts/contactPreplans', () => ({
  getContactPreplan: jest.fn(),
}));

jest.mock('@/api/contacts/contactFiles', () => ({
  getContactFiles: jest.fn(),
}));

jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const preplansApi = jest.requireMock('@/api/contacts/contactPreplans');
const filesApi = jest.requireMock('@/api/contacts/contactFiles');

const preplan = (contactId: string, occupancyNotes: string) => ({ ContactPreplanId: `p-${contactId}`, ContactId: contactId, IsProtected: true, OccupancyNotes: occupancyNotes });

describe('useContactPreplanStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useContactPreplanStore.getState().reset();
  });

  it('serves a fetched pre-plan from the cache until it is forced', async () => {
    preplansApi.getContactPreplan.mockResolvedValue({ Data: preplan('c1', 'Knox box north') });

    await useContactPreplanStore.getState().fetchPreplan('c1');
    await useContactPreplanStore.getState().fetchPreplan('c1');
    expect(preplansApi.getContactPreplan).toHaveBeenCalledTimes(1);

    await useContactPreplanStore.getState().fetchPreplan('c1', true);
    expect(preplansApi.getContactPreplan).toHaveBeenCalledTimes(2);
    expect(useContactPreplanStore.getState().preplans.c1?.OccupancyNotes).toBe('Knox box north');
  });

  it('does not cache a pre-plan or files that answer after sign-out', async () => {
    let releasePreplan!: (value: unknown) => void;
    let releaseFiles!: (value: unknown) => void;
    preplansApi.getContactPreplan.mockReturnValueOnce(new Promise((resolve) => (releasePreplan = resolve)));
    filesApi.getContactFiles.mockReturnValueOnce(new Promise((resolve) => (releaseFiles = resolve)));

    const loadingPreplan = useContactPreplanStore.getState().fetchPreplan('c1');
    const loadingFiles = useContactPreplanStore.getState().fetchFiles('c1');
    useContactPreplanStore.getState().reset();
    releasePreplan({ Data: preplan('c1', 'Revealed under the previous grant') });
    releaseFiles({ Data: [{ Id: 'f1', FileName: 'site.pdf' }] });
    await Promise.all([loadingPreplan, loadingFiles]);

    const state = useContactPreplanStore.getState();
    expect(state.preplans).toEqual({});
    expect(state.files).toEqual({});
    expect(state.loadingPreplan).toEqual({});
    expect(state.loadingFiles).toEqual({});
  });

  it('ignores a failure that lands after sign-out', async () => {
    let rejectPreplan!: (reason: unknown) => void;
    preplansApi.getContactPreplan.mockReturnValueOnce(new Promise((_resolve, reject) => (rejectPreplan = reject)));

    const loading = useContactPreplanStore.getState().fetchPreplan('c1');
    useContactPreplanStore.getState().reset();
    rejectPreplan(new Error('Network Error'));
    await loading;

    expect(useContactPreplanStore.getState().error).toBeNull();
  });
});
