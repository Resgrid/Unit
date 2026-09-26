import { goldenCatalogEntry } from '@/lib/records/__tests__/fixtures';
import { RmsRecordState } from '@/models/v4/records';
import { RECORDS_ORIGIN_CLIENT, useRecordsStore } from '@/stores/records/store';

// Shared conformance suite for the Field Records store (RMS plan RMS-1D). Identical in all four app
// repositories apart from the origin each one reports, which is asserted here rather than assumed.

jest.mock('@/lib/records/uploads', () => ({
  runUpload: jest.fn(),
  cancelUpload: jest.fn(),
}));

jest.mock('@/api/records/field-records', () => ({
  reportFieldRecordTelemetry: jest.fn(),
  getFieldRecordsPreflight: jest.fn(),
  getFieldRecordsCatalog: jest.fn(),
  getFieldRecordPrefill: jest.fn(),
  syncFieldRecords: jest.fn(),
  getFieldRecordAssignments: jest.fn(),
  getAssignmentsForRecord: jest.fn(),
  acknowledgeAssignment: jest.fn(),
  completeAssignment: jest.fn(),
}));

jest.mock('@/api/records/records', () => ({
  getRecord: jest.fn(),
  getRecordDefinitionVersion: jest.fn(),
  createRecordDraft: jest.fn(),
  saveRecordDraft: jest.fn(),
  submitRecordForReview: jest.fn(),
  finalizeRecord: jest.fn(),
  cancelRecord: jest.fn(),
}));

jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const fieldApi = jest.requireMock('@/api/records/field-records');
const recordsApi = jest.requireMock('@/api/records/records');
const uploads = jest.requireMock('@/lib/records/uploads');

const resetStore = () => {
  // reset() also drops queued telemetry, which is module state a setState cannot reach.
  useRecordsStore.getState().reset();
  useRecordsStore.setState({
    preflight: null,
    catalog: null,
    assignments: [],
    recent: [],
    drafts: [],
    pendingDrafts: {},
    pendingUploads: {},
    uploadProgress: {},
    schemas: {},
    scopeStamp: null,
    lastSyncTimestampMs: 0,
    isLoading: false,
    isSyncing: false,
    error: null,
    context: {},
  });
};

const catalogOf = (definitionKey = 'shift-log', overrides: Parameters<typeof goldenCatalogEntry>[0] = {}) => ({
  ContractVersion: 'field-catalog.v1',
  OriginClient: 'Unit',
  Ok: true,
  Reasons: [],
  ContextVerified: true,
  Definitions: [goldenCatalogEntry({ DefinitionKey: definitionKey, ...overrides })],
  Exclusions: [],
  ServerTimestampMs: 0,
});

const summary = (id: string, state: number, modifiedOn: string) => ({
  RecordId: id,
  DefinitionVersion: 3,
  State: state,
  CreatedOn: modifiedOn,
  ModifiedOn: modifiedOn,
  RowVersion: 1,
});

describe('Field Records store conformance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  it('reports this app as its own field origin', () => {
    expect([2, 3, 4, 5]).toContain(RECORDS_ORIGIN_CLIENT as number);
  });

  it('keeps the sync delta and drops what the caller may no longer read', async () => {
    const page = (overrides: Record<string, unknown>) => ({ Data: { Ok: true, ResetRequired: false, Records: [], Tombstones: [], Drafts: [], Assignments: [], ...overrides } });
    // The first sync for a context is a full pull; it is what a later delta builds on.
    fieldApi.syncFieldRecords.mockResolvedValueOnce(
      page({ ScopeStamp: 'scope-1', ServerTimestampMs: 500, Records: [summary('r1', RmsRecordState.Finalized, '2026-09-01T00:00:00Z'), summary('r9', RmsRecordState.Finalized, '2026-09-01T00:00:00Z')] })
    );
    await useRecordsStore.getState().sync();

    fieldApi.syncFieldRecords.mockResolvedValueOnce(
      page({
        ScopeStamp: 'scope-1',
        ServerTimestampMs: 1000,
        Records: [summary('r2', RmsRecordState.Finalized, '2026-09-02T00:00:00Z')],
        Tombstones: ['r9'],
        Drafts: [summary('d1', RmsRecordState.Draft, '2026-09-02T00:00:00Z')],
        Assignments: [{ AssignmentId: 'a1', RecordId: 'r2', AssigneeKind: 'Person', Purpose: 'complete', State: 'Open', CreatedOn: '2026-09-02T00:00:00Z', RowVersion: 1 }],
      })
    );
    await useRecordsStore.getState().sync();

    expect(fieldApi.syncFieldRecords.mock.calls[1][0]).toMatchObject({ Since: 500, ScopeStamp: 'scope-1' });
    const state = useRecordsStore.getState();
    expect(state.recent.map((record) => record.RecordId)).toEqual(['r2', 'r1']);
    expect(state.recent.some((record) => record.RecordId === 'r9')).toBe(false);
    expect(state.drafts).toHaveLength(1);
    expect(state.assignments).toHaveLength(1);
    expect(state.scopeStamp).toBe('scope-1');
    expect(state.lastSyncTimestampMs).toBe(1000);
  });

  it('clears the cached working set and re-pulls when the server says the scope changed', async () => {
    fieldApi.syncFieldRecords
      .mockResolvedValueOnce({
        Data: { Ok: true, ResetRequired: false, ScopeStamp: 'scope-0', ServerTimestampMs: 500, Records: [summary('r1', RmsRecordState.Finalized, '2026-09-01T00:00:00Z')], Tombstones: [], Drafts: [], Assignments: [] },
      })
      .mockResolvedValueOnce({ Data: { Ok: true, ResetRequired: true, ScopeStamp: 'scope-2', ServerTimestampMs: 0, Records: [], Tombstones: [], Drafts: [], Assignments: [] } })
      .mockResolvedValueOnce({ Data: { Ok: true, ResetRequired: false, ScopeStamp: 'scope-2', ServerTimestampMs: 900, Records: [], Tombstones: [], Drafts: [], Assignments: [] } });
    await useRecordsStore.getState().sync();
    expect(useRecordsStore.getState().recent).toHaveLength(1);

    await useRecordsStore.getState().sync();

    expect(useRecordsStore.getState().recent).toEqual([]);
    expect(useRecordsStore.getState().scopeStamp).toBe('scope-2');
    expect(fieldApi.syncFieldRecords).toHaveBeenCalledTimes(3);
    expect(fieldApi.syncFieldRecords.mock.calls[1][0]).toMatchObject({ Since: 500, ScopeStamp: 'scope-0' });
    expect(fieldApi.syncFieldRecords.mock.calls[2][0]).toMatchObject({ Since: 0, ScopeStamp: null });
  });

  it('pulls in full and rebuilds the lists for a context it has not synced for', async () => {
    const page = (recordId: string, timestamp: number) => ({
      Data: {
        Ok: true,
        ResetRequired: false,
        ScopeStamp: 'scope-1',
        ServerTimestampMs: timestamp,
        Records: [summary(recordId, RmsRecordState.Finalized, '2026-09-01T00:00:00Z')],
        Tombstones: [],
        Drafts: [],
        Assignments: [],
      },
    });
    // A cursor kept from an earlier launch is not a delta base: the lists it was built with are gone.
    useRecordsStore.setState({ lastSyncTimestampMs: 400, scopeStamp: 'scope-1' });
    fieldApi.syncFieldRecords.mockResolvedValueOnce(page('r501', 500)).mockResolvedValueOnce(page('r502', 600));

    useRecordsStore.getState().setContext({ CallId: 501 });
    await useRecordsStore.getState().sync();
    useRecordsStore.getState().setContext({ CallId: 502 });
    await useRecordsStore.getState().sync();

    expect(fieldApi.syncFieldRecords.mock.calls[0][0]).toMatchObject({ Since: 0, ScopeStamp: null });
    expect(fieldApi.syncFieldRecords.mock.calls[1][0]).toMatchObject({ Since: 0, ScopeStamp: null, Context: { CallId: 502 } });
    expect(useRecordsStore.getState().recent.map((record) => record.RecordId)).toEqual(['r502']);
  });

  it('refuses to stage a protected definition on the device', () => {
    useRecordsStore.setState({ catalog: { ContractVersion: 'field-catalog.v1', OriginClient: 'Unit', Ok: true, Reasons: [], ContextVerified: true, Definitions: [goldenCatalogEntry({ RequiresProtectedGrant: true })], Exclusions: [], ServerTimestampMs: 0 } });

    useRecordsStore.getState().stageDraft({
      clientRecordId: 'draft-1',
      recordId: null,
      definitionKey: 'shift-log',
      definitionVersion: 3,
      name: 'Shift log',
      values: [],
      updatedOn: '2026-09-06T00:00:00Z',
    });

    expect(useRecordsStore.getState().pendingDrafts).toEqual({});
  });

  it('sends a protected definition online without ever keeping it on the device', async () => {
    useRecordsStore.setState({ catalog: { ContractVersion: 'field-catalog.v1', OriginClient: 'Unit', Ok: true, Reasons: [], ContextVerified: true, Definitions: [goldenCatalogEntry({ RequiresProtectedGrant: true })], Exclusions: [], ServerTimestampMs: 0 } });
    const draft = { clientRecordId: 'draft-p', recordId: null, definitionKey: 'shift-log', definitionVersion: 3, name: 'Shift log', values: [], updatedOn: '2026-09-06T00:00:00Z' };
    recordsApi.createRecordDraft.mockRejectedValueOnce({ response: { status: 500, data: { title: 'Unavailable' } } }).mockResolvedValueOnce({ Data: { RecordId: 'server-p', DefinitionVersion: 3, State: RmsRecordState.Draft, RowVersion: 1 } });
    fieldApi.syncFieldRecords.mockResolvedValue({ Data: { Ok: true, ResetRequired: false, ScopeStamp: 'scope-1', ServerTimestampMs: 10, Records: [], Tombstones: [], Drafts: [], Assignments: [] } });

    useRecordsStore.getState().stageDraft(draft);
    const failed = await useRecordsStore.getState().pushDraft('draft-p', draft);

    expect(failed).toMatchObject({ ok: false, error: 'Unavailable' });
    expect(useRecordsStore.getState().pendingDrafts).toEqual({});

    const sent = await useRecordsStore.getState().pushDraft('draft-p', draft);

    expect(sent).toMatchObject({ ok: true, recordId: 'server-p' });
    expect(recordsApi.createRecordDraft).toHaveBeenLastCalledWith(expect.objectContaining({ DefinitionKey: 'shift-log', IdempotencyKey: 'draft-p' }));
    expect(useRecordsStore.getState().pendingDrafts).toEqual({});
  });

  it('keeps a conflicted draft and never replays it in the batch push', async () => {
    useRecordsStore.setState({ catalog: { ContractVersion: 'field-catalog.v1', OriginClient: 'Unit', Ok: true, Reasons: [], ContextVerified: true, Definitions: [goldenCatalogEntry()], Exclusions: [], ServerTimestampMs: 0 } });
    recordsApi.createRecordDraft.mockRejectedValue({ response: { status: 409, data: { type: 'record_concurrency', title: 'Changed' } } });

    useRecordsStore.getState().stageDraft({
      clientRecordId: 'draft-2',
      recordId: null,
      definitionKey: 'shift-log',
      definitionVersion: 3,
      name: 'Shift log',
      values: [],
      updatedOn: '2026-09-06T00:00:00Z',
    });

    const result = await useRecordsStore.getState().pushDraft('draft-2');

    expect(result.ok).toBe(false);
    expect(result.conflict).toBe('etag');
    expect(useRecordsStore.getState().pendingDrafts['draft-2'].conflict).toBe('etag');

    recordsApi.createRecordDraft.mockClear();
    await useRecordsStore.getState().pushAllDrafts();
    expect(recordsApi.createRecordDraft).not.toHaveBeenCalled();
  });

  it('clears a staged draft once the server accepts it', async () => {
    useRecordsStore.setState({ catalog: { ContractVersion: 'field-catalog.v1', OriginClient: 'Unit', Ok: true, Reasons: [], ContextVerified: true, Definitions: [goldenCatalogEntry()], Exclusions: [], ServerTimestampMs: 0 } });
    recordsApi.createRecordDraft.mockResolvedValue({ Data: { RecordId: 'server-1', DefinitionVersion: 3, State: RmsRecordState.Draft, RowVersion: 1 } });
    fieldApi.syncFieldRecords.mockResolvedValue({ Data: { Ok: true, ResetRequired: false, ScopeStamp: 'scope-1', ServerTimestampMs: 10, Records: [], Tombstones: [], Drafts: [], Assignments: [] } });

    useRecordsStore.getState().stageDraft({
      clientRecordId: 'draft-3',
      recordId: null,
      definitionKey: 'shift-log',
      definitionVersion: 3,
      name: 'Shift log',
      values: [],
      updatedOn: '2026-09-06T00:00:00Z',
    });

    const result = await useRecordsStore.getState().pushDraft('draft-3');

    expect(result).toMatchObject({ ok: true, recordId: 'server-1' });
    expect(useRecordsStore.getState().pendingDrafts['draft-3']).toBeUndefined();
    expect(recordsApi.createRecordDraft).toHaveBeenCalledWith(expect.objectContaining({ IdempotencyKey: 'draft-3', OriginClient: RECORDS_ORIGIN_CLIENT }));
  });

  it('keeps an interrupted upload so it can resume, and never retries a missing file', async () => {
    const upload = {
      localId: 'upload-1',
      recordId: 'r1',
      uploadId: null,
      fileUri: 'file:///photo.jpg',
      fileName: 'photo.jpg',
      contentType: 'image/jpeg',
      byteSize: 900,
      sha256: 'abc',
      sentBytes: 0,
      classification: 1,
      createdOn: '2026-09-06T00:00:00Z',
    };

    uploads.runUpload.mockResolvedValueOnce({ ok: false, code: 'chunk_failed', sentBytes: 300, uploadId: 'session-1', message: 'Lost signal' });
    useRecordsStore.getState().stageUpload(upload);
    let outcome = await useRecordsStore.getState().runUploads('r1');

    expect(outcome).toEqual({ uploaded: 0, failed: 1 });
    const kept = useRecordsStore.getState().pendingUploads['upload-1'];
    expect(kept.sentBytes).toBe(300);
    expect(kept.uploadId).toBe('session-1');
    expect(kept.isUnrecoverable).toBeFalsy();

    uploads.runUpload.mockResolvedValueOnce({ ok: false, code: 'file_missing' });
    outcome = await useRecordsStore.getState().runUploads('r1');
    expect(useRecordsStore.getState().pendingUploads['upload-1'].isUnrecoverable).toBe(true);

    uploads.runUpload.mockClear();
    outcome = await useRecordsStore.getState().runUploads('r1');
    expect(uploads.runUpload).not.toHaveBeenCalled();
    expect(outcome).toEqual({ uploaded: 0, failed: 0 });
  });

  it('clears an upload once the server has the attachment', async () => {
    uploads.runUpload.mockResolvedValue({ ok: true, attachment: { AttachmentId: 'a1' }, sentBytes: 900 });
    useRecordsStore.getState().stageUpload({
      localId: 'upload-2',
      recordId: 'r1',
      uploadId: null,
      fileUri: 'file:///photo.jpg',
      fileName: 'photo.jpg',
      contentType: 'image/jpeg',
      byteSize: 900,
      sha256: 'abc',
      sentBytes: 0,
      classification: 1,
      createdOn: '2026-09-06T00:00:00Z',
    });

    const outcome = await useRecordsStore.getState().runUploads('r1');

    expect(outcome).toEqual({ uploaded: 1, failed: 0 });
    expect(useRecordsStore.getState().pendingUploads['upload-2']).toBeUndefined();
    expect(useRecordsStore.getState().uploadProgress['upload-2']).toBeUndefined();
  });

  it('hands a discarded upload back to the server and batches telemetry without content', async () => {
    useRecordsStore.getState().stageUpload({
      localId: 'upload-3',
      recordId: 'r1',
      uploadId: 'session-9',
      fileUri: 'file:///photo.jpg',
      fileName: 'photo.jpg',
      contentType: 'image/jpeg',
      byteSize: 10,
      sha256: 'abc',
      sentBytes: 0,
      classification: 1,
      createdOn: '2026-09-06T00:00:00Z',
    });

    await useRecordsStore.getState().discardUpload('upload-3');

    expect(uploads.cancelUpload).toHaveBeenCalledWith('session-9');
    expect(useRecordsStore.getState().pendingUploads['upload-3']).toBeUndefined();

    fieldApi.reportFieldRecordTelemetry.mockResolvedValue({ Data: { Accepted: 1 } });
    useRecordsStore.getState().report({ EventType: 'attachment', Outcome: 'ok', RecordId: 'r1', ItemCount: 12 });
    await useRecordsStore.getState().flushTelemetry();

    const batch = fieldApi.reportFieldRecordTelemetry.mock.calls[0][0];
    expect(batch.OriginClient).toBe(RECORDS_ORIGIN_CLIENT);
    expect(batch.Events[0]).toMatchObject({ EventType: 'attachment', Outcome: 'ok', ItemCount: 12 });
    expect(JSON.stringify(batch)).not.toContain('photo.jpg');

    fieldApi.reportFieldRecordTelemetry.mockClear();
    await useRecordsStore.getState().flushTelemetry();
    expect(fieldApi.reportFieldRecordTelemetry).not.toHaveBeenCalled();
  });

  it('drops the catalog when the context changes so it is never shown against another context', () => {
    useRecordsStore.setState({ catalog: { ContractVersion: 'field-catalog.v1', OriginClient: 'Unit', Ok: true, Reasons: [], ContextVerified: true, Definitions: [goldenCatalogEntry()], Exclusions: [], ServerTimestampMs: 0 } });

    useRecordsStore.getState().setContext({ CallId: 501 });

    expect(useRecordsStore.getState().catalog).toBeNull();
    expect(useRecordsStore.getState().context).toEqual({ CallId: 501 });
  });

  it('treats a different contact as a different context', () => {
    useRecordsStore.getState().setContext({ CallId: 501, ContactId: 7 });
    useRecordsStore.setState({ catalog: catalogOf() });

    useRecordsStore.getState().setContext({ CallId: 501, ContactId: 8 });

    expect(useRecordsStore.getState().context).toEqual({ CallId: 501, ContactId: 8 });
    expect(useRecordsStore.getState().catalog).toBeNull();
  });

  it('never lets a catalog asked for an earlier context replace the current one', async () => {
    let releaseFirst!: (value: unknown) => void;
    fieldApi.getFieldRecordsCatalog.mockReturnValueOnce(new Promise((resolve) => (releaseFirst = resolve))).mockResolvedValueOnce({ Data: catalogOf('call-502-form') });

    useRecordsStore.getState().setContext({ CallId: 501 });
    const earlier = useRecordsStore.getState().fetchCatalog();
    useRecordsStore.getState().setContext({ CallId: 502 });
    await useRecordsStore.getState().fetchCatalog();
    releaseFirst({ Data: catalogOf('call-501-form') });

    expect(await earlier).toBeNull();
    expect(useRecordsStore.getState().catalog?.Definitions.map((entry) => entry.DefinitionKey)).toEqual(['call-502-form']);
  });

  it('drops a sync bundle that answers after the context changed', async () => {
    let release!: (value: unknown) => void;
    fieldApi.syncFieldRecords.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));

    useRecordsStore.getState().setContext({ CallId: 501 });
    const syncing = useRecordsStore.getState().sync();
    useRecordsStore.getState().setContext({ CallId: 502 });
    release({ Data: { Ok: true, ResetRequired: false, ScopeStamp: 'scope-501', ServerTimestampMs: 700, Catalog: catalogOf('call-501-form'), Records: [summary('r1', RmsRecordState.Finalized, '2026-09-01T00:00:00Z')], Tombstones: [], Drafts: [], Assignments: [] } });
    await syncing;

    const state = useRecordsStore.getState();
    expect(state.catalog).toBeNull();
    expect(state.recent).toEqual([]);
    expect(state.lastSyncTimestampMs).toBe(0);
    expect(state.isSyncing).toBe(false);
  });

  it('syncs a new context even while a sync for an earlier context is still running', async () => {
    let releaseEarlier!: (value: unknown) => void;
    const bundle = (scopeStamp: string, recordId: string) => ({ Data: { Ok: true, ResetRequired: false, ScopeStamp: scopeStamp, ServerTimestampMs: 900, Records: [summary(recordId, RmsRecordState.Finalized, '2026-09-02T00:00:00Z')], Tombstones: [], Drafts: [], Assignments: [] } });
    fieldApi.syncFieldRecords.mockReturnValueOnce(new Promise((resolve) => (releaseEarlier = resolve))).mockResolvedValueOnce(bundle('scope-502', 'r502'));

    useRecordsStore.getState().setContext({ CallId: 501 });
    const earlier = useRecordsStore.getState().sync();
    useRecordsStore.getState().setContext({ CallId: 502 });
    await useRecordsStore.getState().sync();

    expect(fieldApi.syncFieldRecords).toHaveBeenCalledTimes(2);
    expect(fieldApi.syncFieldRecords.mock.calls[1][0].Context).toEqual({ CallId: 502 });
    expect(useRecordsStore.getState().recent.map((record) => record.RecordId)).toEqual(['r502']);
    expect(useRecordsStore.getState().isSyncing).toBe(false);

    releaseEarlier(bundle('scope-501', 'r501'));
    await earlier;
    expect(useRecordsStore.getState().recent.map((record) => record.RecordId)).toEqual(['r502']);
    expect(useRecordsStore.getState().isSyncing).toBe(false);
  });

  it('keeps the newest catalog when an older request for the same context answers last', async () => {
    let releaseOlder!: (value: unknown) => void;
    fieldApi.getFieldRecordsCatalog.mockReturnValueOnce(new Promise((resolve) => (releaseOlder = resolve))).mockResolvedValueOnce({ Data: catalogOf('newer-form') });

    useRecordsStore.getState().setContext({ CallId: 501 });
    const older = useRecordsStore.getState().fetchCatalog();
    await useRecordsStore.getState().fetchCatalog();
    releaseOlder({ Data: { ...catalogOf('older-form'), ScopeStamp: 'scope-old' } });

    expect(await older).toBeNull();
    expect(useRecordsStore.getState().catalog?.Definitions.map((entry) => entry.DefinitionKey)).toEqual(['newer-form']);
    expect(useRecordsStore.getState().scopeStamp).not.toBe('scope-old');
  });

  it('keeps loading until the newest catalog request answers', async () => {
    let releaseEarlier!: (value: unknown) => void;
    let releaseNewer!: (value: unknown) => void;
    fieldApi.getFieldRecordsCatalog.mockReturnValueOnce(new Promise((resolve) => (releaseEarlier = resolve))).mockReturnValueOnce(new Promise((resolve) => (releaseNewer = resolve)));

    useRecordsStore.getState().setContext({ CallId: 501 });
    const earlier = useRecordsStore.getState().fetchCatalog();
    useRecordsStore.getState().setContext({ CallId: 502 });
    const newer = useRecordsStore.getState().fetchCatalog();

    releaseEarlier({ Data: catalogOf('call-501-form') });
    await earlier;
    expect(useRecordsStore.getState().isLoading).toBe(true);

    releaseNewer({ Data: catalogOf('call-502-form') });
    await newer;
    expect(useRecordsStore.getState().isLoading).toBe(false);
    expect(useRecordsStore.getState().catalog?.Definitions.map((entry) => entry.DefinitionKey)).toEqual(['call-502-form']);
  });

  it('hands back the record the server accepted, with its new row version', async () => {
    recordsApi.saveRecordDraft.mockResolvedValue({ Data: { RecordId: 'r1', DefinitionVersion: 3, State: RmsRecordState.Draft, RowVersion: 6 } });
    fieldApi.syncFieldRecords.mockResolvedValue({ Data: { Ok: true, ResetRequired: false, ScopeStamp: 'scope-1', ServerTimestampMs: 10, Records: [], Tombstones: [], Drafts: [], Assignments: [] } });
    const draft = { clientRecordId: 'edit-r1-5', recordId: 'r1', definitionKey: 'shift-log', definitionVersion: 3, name: 'Shift log', values: [], rowVersion: 5, updatedOn: '2026-09-06T00:00:00Z' };

    const result = await useRecordsStore.getState().pushDraft('edit-r1-5', draft);

    expect(result).toMatchObject({ ok: true, recordId: 'r1', record: { RecordId: 'r1', RowVersion: 6 } });
  });

  it('removes a protected draft staged before the catalog loaded once its send fails', async () => {
    const draft = { clientRecordId: 'draft-early', recordId: null, definitionKey: 'shift-log', definitionVersion: 3, name: 'Shift log', values: [], updatedOn: '2026-09-06T00:00:00Z' };
    useRecordsStore.getState().stageDraft(draft);
    expect(useRecordsStore.getState().pendingDrafts['draft-early']).toBeDefined();

    useRecordsStore.setState({ catalog: catalogOf('shift-log', { RequiresProtectedGrant: true }) });
    recordsApi.createRecordDraft.mockRejectedValueOnce({ response: { status: 403, data: { type: 'protected_data_required', title: 'Grant required' } } });

    const result = await useRecordsStore.getState().pushDraft('draft-early');

    expect(result.ok).toBe(false);
    expect(useRecordsStore.getState().pendingDrafts).toEqual({});
  });

  it('does not restore a draft whose send fails after sign-out', async () => {
    let reject!: (reason: unknown) => void;
    recordsApi.createRecordDraft.mockReturnValueOnce(new Promise((_resolve, rejectWith) => (reject = rejectWith)));
    useRecordsStore.getState().stageDraft({ clientRecordId: 'draft-old', recordId: null, definitionKey: 'shift-log', definitionVersion: 3, name: 'Shift log', values: [], updatedOn: '2026-09-06T00:00:00Z' });

    const pushing = useRecordsStore.getState().pushDraft('draft-old');
    useRecordsStore.getState().reset();
    reject({ response: { status: 500, data: { title: 'Unavailable' } } });
    await pushing;

    expect(useRecordsStore.getState().pendingDrafts).toEqual({});
  });

  it('stops an upload batch at sign-out and writes nothing back', async () => {
    const upload = (localId: string) => ({ localId, recordId: 'r1', uploadId: null, fileUri: `file:///${localId}.jpg`, fileName: `${localId}.jpg`, contentType: 'image/jpeg', byteSize: 9, sha256: 'abc', sentBytes: 0, classification: 1, createdOn: '2026-09-06T00:00:00Z' });
    useRecordsStore.setState({ pendingUploads: { first: upload('first'), second: upload('second') } });
    uploads.runUpload.mockImplementationOnce(async () => {
      useRecordsStore.getState().reset();
      return { ok: false, code: 'failed', sentBytes: 3, uploadId: 'session-1' };
    });

    await useRecordsStore.getState().runUploads();

    expect(uploads.runUpload).toHaveBeenCalledTimes(1);
    expect(useRecordsStore.getState().pendingUploads).toEqual({});
  });
});
