import { hashFile, runUpload } from '@/lib/records/uploads';

// Shared conformance suite for resumable attachment upload (RMS plan RMS-1D). Identical in all four
// app repositories: the server owns the session, so every adapter must resume from the server's own
// byte count rather than its own, and must surface a failure instead of retrying it silently.

jest.mock('@/api/records/record-uploads', () => ({
  beginRecordUpload: jest.fn(),
  uploadRecordChunk: jest.fn(),
  getRecordUpload: jest.fn(),
  completeRecordUpload: jest.fn(),
  abortRecordUpload: jest.fn(),
  getRecordAttachments: jest.fn(),
  removeRecordAttachment: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
}));

// A real SHA-256 over whatever bytes the adapter hands over, so the test proves which bytes those are.
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
  digestStringAsync: jest.fn(async (_algorithm: string, data: string) => jest.requireActual('crypto').createHash('sha256').update(data, 'utf8').digest('hex')),
  digest: jest.fn(async (_algorithm: string, data: Uint8Array) => {
    const hash: Uint8Array = jest.requireActual('crypto').createHash('sha256').update(data).digest();
    return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
  }),
}));

jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const api = jest.requireMock('@/api/records/record-uploads');
const fs = jest.requireMock('expo-file-system/legacy');

// 9 bytes encodes to 12 base64 characters, so a 3-byte chunk size slices cleanly.
const NINE_BYTES_BASE64 = 'AAAAAAAAAAAA';

const pending = (overrides: Record<string, unknown> = {}) => ({
  localId: 'upload-1',
  recordId: 'r1',
  uploadId: null,
  fileUri: 'file:///photo.jpg',
  fileName: 'photo.jpg',
  contentType: 'image/jpeg',
  byteSize: 9,
  sha256: 'abc',
  sentBytes: 0,
  classification: 1,
  createdOn: '2026-09-06T00:00:00Z',
  ...overrides,
});

const session = (receivedBytes: number, chunkSize = 3) => ({
  Data: {
    UploadId: 'session-1',
    RecordId: 'r1',
    FileName: 'photo.jpg',
    ContentType: 'image/jpeg',
    DeclaredSize: 9,
    ReceivedBytes: receivedBytes,
    ChunkSize: chunkSize,
    ChunkCount: 3,
    State: 1,
    ExpiresOn: '2026-09-07T00:00:00Z',
  },
});

describe('Record attachment uploads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 9 });
    fs.readAsStringAsync.mockResolvedValue(NINE_BYTES_BASE64);
  });

  it('sends the file in chunks and completes it', async () => {
    api.beginRecordUpload.mockResolvedValue(session(0));
    api.uploadRecordChunk.mockResolvedValueOnce(session(3)).mockResolvedValueOnce(session(6)).mockResolvedValueOnce(session(9));
    api.completeRecordUpload.mockResolvedValue({ Data: { AttachmentId: 'a1', FileName: 'photo.jpg', MetadataStripped: true, MediaLocationRetained: false } });
    const progress: number[] = [];

    const outcome = await runUpload(pending() as never, { onProgress: ({ sentBytes }) => progress.push(sentBytes) });

    expect(outcome.ok).toBe(true);
    expect(outcome.attachment?.AttachmentId).toBe('a1');
    expect(api.uploadRecordChunk).toHaveBeenCalledTimes(3);
    const offsets = api.uploadRecordChunk.mock.calls.map((call: unknown[]) => (call[0] as { Offset: number }).Offset);
    expect(offsets).toEqual([0, 3, 6]);
    expect(progress).toEqual([0, 3, 6, 9]);
  });

  it('sends the whole padded group for a final chunk that is not a multiple of 3 bytes', async () => {
    // 10 bytes: three full 3-byte chunks (4 base64 chars each) and a trailing single byte, which
    // base64 pads to a full 4-character group ("AA==") that must reach the server intact.
    const tenBytesBase64 = 'AAAAAAAAAAAAAA==';
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 10 });
    fs.readAsStringAsync.mockResolvedValue(tenBytesBase64);
    api.beginRecordUpload.mockResolvedValue({ Data: { ...session(0).Data, DeclaredSize: 10, ChunkCount: 4 } });
    api.uploadRecordChunk.mockResolvedValueOnce(session(3)).mockResolvedValueOnce(session(6)).mockResolvedValueOnce(session(9)).mockResolvedValueOnce(session(10));
    api.completeRecordUpload.mockResolvedValue({ Data: { AttachmentId: 'a4' } });

    const outcome = await runUpload(pending({ byteSize: 10 }) as never);

    expect(outcome.ok).toBe(true);
    const chunks: { Offset: number; Data: string }[] = api.uploadRecordChunk.mock.calls.map((call: unknown[]) => call[0] as { Offset: number; Data: string });
    expect(chunks.map((chunk) => chunk.Offset)).toEqual([0, 3, 6, 9]);
    expect(chunks.map((chunk) => chunk.Data)).toEqual(['AAAA', 'AAAA', 'AAAA', 'AA==']);
    expect(chunks.map((chunk) => chunk.Data).join('')).toBe(tenBytesBase64);
  });

  it('resumes from a server count that is not a whole base64 group without shifting the bytes', async () => {
    // Nine distinct bytes, so a chunk that starts one byte off would send the wrong ones.
    const file = Buffer.from([10, 11, 12, 13, 14, 15, 16, 17, 18]);
    fs.readAsStringAsync.mockResolvedValue(file.toString('base64'));
    api.getRecordUpload.mockResolvedValue(session(4));
    api.uploadRecordChunk.mockResolvedValueOnce(session(7)).mockResolvedValueOnce(session(9));
    api.completeRecordUpload.mockResolvedValue({ Data: { AttachmentId: 'a5' } });

    const outcome = await runUpload(pending({ uploadId: 'session-1' }) as never);

    expect(outcome.ok).toBe(true);
    const chunks: { Offset: number; Data: string }[] = api.uploadRecordChunk.mock.calls.map((call: unknown[]) => call[0] as { Offset: number; Data: string });
    expect(chunks.map((chunk) => chunk.Offset)).toEqual([4, 7]);
    expect(chunks.map((chunk) => [...Buffer.from(chunk.Data, 'base64')])).toEqual([
      [14, 15, 16],
      [17, 18],
    ]);
  });

  it('cuts chunks at the server chunk size even when it is not a multiple of 3', async () => {
    // The server declares 512 KiB, which is not a multiple of 3; it refuses any chunk that is not exactly
    // that size except the last, so the chunks are cut from the bytes, not from the base64 text.
    const bytes = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    fs.getInfoAsync.mockResolvedValue({ exists: true, size: 10 });
    fs.readAsStringAsync.mockResolvedValue(bytes.toString('base64'));
    api.beginRecordUpload.mockResolvedValue(session(0, 4));
    api.uploadRecordChunk.mockResolvedValueOnce(session(4, 4)).mockResolvedValueOnce(session(8, 4)).mockResolvedValueOnce(session(10, 4));
    api.completeRecordUpload.mockResolvedValue({ Data: { AttachmentId: 'a5' } });

    const outcome = await runUpload(pending({ byteSize: 10 }) as never);

    expect(outcome.ok).toBe(true);
    const chunks: { Offset: number; Data: string }[] = api.uploadRecordChunk.mock.calls.map((call: unknown[]) => call[0] as { Offset: number; Data: string });
    expect(chunks.map((chunk) => chunk.Offset)).toEqual([0, 4, 8]);
    expect(chunks.map((chunk) => Buffer.from(chunk.Data, 'base64').length)).toEqual([4, 4, 2]);
    expect(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk.Data, 'base64')))).toEqual(bytes);
  });

  it('resumes from the count the server reports, not the one the device remembers', async () => {
    api.getRecordUpload.mockResolvedValue(session(6));
    api.uploadRecordChunk.mockResolvedValue(session(9));
    api.completeRecordUpload.mockResolvedValue({ Data: { AttachmentId: 'a2' } });

    const outcome = await runUpload(pending({ uploadId: 'session-1', sentBytes: 0 }) as never);

    expect(outcome.ok).toBe(true);
    expect(api.beginRecordUpload).not.toHaveBeenCalled();
    expect(api.uploadRecordChunk).toHaveBeenCalledTimes(1);
    expect(api.uploadRecordChunk.mock.calls[0][0].Offset).toBe(6);
  });

  it('opens a new session when the old one is gone or closed', async () => {
    api.getRecordUpload.mockResolvedValue({ Data: { ...session(9).Data, State: 4 } });
    api.beginRecordUpload.mockResolvedValue(session(0));
    api.uploadRecordChunk.mockResolvedValueOnce(session(3)).mockResolvedValueOnce(session(6)).mockResolvedValueOnce(session(9));
    api.completeRecordUpload.mockResolvedValue({ Data: { AttachmentId: 'a3' } });

    const outcome = await runUpload(pending({ uploadId: 'expired' }) as never);

    expect(outcome.ok).toBe(true);
    expect(api.beginRecordUpload).toHaveBeenCalledTimes(1);
  });

  it('reports a missing file as unrecoverable rather than trying to send it', async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: false });

    const outcome = await runUpload(pending() as never);

    expect(outcome).toMatchObject({ ok: false, code: 'file_missing' });
    expect(api.beginRecordUpload).not.toHaveBeenCalled();
    expect(api.uploadRecordChunk).not.toHaveBeenCalled();
  });

  it('surfaces a rejected upload with the server code and keeps how far it got', async () => {
    api.beginRecordUpload.mockResolvedValue(session(0));
    api.uploadRecordChunk.mockRejectedValue({ response: { status: 422, data: { type: 'upload_rejected', title: 'That file type is not accepted.' } } });

    const outcome = await runUpload(pending() as never);

    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe('upload_rejected');
    expect(outcome.message).toBe('That file type is not accepted.');
  });

  it('hashes the file bytes the server will assemble, not their base64 text', async () => {
    fs.readAsStringAsync.mockResolvedValue('YWJj');

    // SHA-256 of the three bytes "abc".
    expect(await hashFile('file:///abc.txt')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('stops instead of resending forever when the server count does not advance', async () => {
    api.beginRecordUpload.mockResolvedValue(session(0));
    api.uploadRecordChunk.mockResolvedValueOnce(session(3)).mockResolvedValue(session(3));

    const outcome = await runUpload(pending() as never);

    expect(outcome).toMatchObject({ ok: false, code: 'chunk_not_accepted', sentBytes: 3, uploadId: 'session-1' });
    expect(api.uploadRecordChunk).toHaveBeenCalledTimes(2);
    expect(api.completeRecordUpload).not.toHaveBeenCalled();
  });

  it('stops between chunks when the person cancels', async () => {
    api.beginRecordUpload.mockResolvedValue(session(0));
    api.uploadRecordChunk.mockResolvedValue(session(3));
    let calls = 0;

    const outcome = await runUpload(pending() as never, {
      shouldCancel: () => {
        calls += 1;
        return calls > 1;
      },
    });

    expect(outcome).toMatchObject({ ok: false, code: 'cancelled', sentBytes: 3 });
    expect(api.completeRecordUpload).not.toHaveBeenCalled();
  });
});
