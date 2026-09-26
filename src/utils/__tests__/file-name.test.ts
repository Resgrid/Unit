import { safeFileName } from '../file-name';

describe('safeFileName', () => {
  it('keeps an ordinary file name as it is', () => {
    expect(safeFileName('Site plan (rev 2).pdf', 'fallback')).toBe('Site plan (rev 2).pdf');
  });

  it('keeps only the last segment of a name that carries a path', () => {
    expect(safeFileName('../../Library/Preferences/app.plist', 'fallback')).toBe('app.plist');
    expect(safeFileName('..\\..\\evil.bin', 'fallback')).toBe('evil.bin');
    expect(safeFileName('/etc/hosts', 'fallback')).toBe('hosts');
  });

  it('neutralizes characters that change how a file uri is read', () => {
    expect(safeFileName('..%2F..%2Fsecret.txt', 'fallback')).toBe('.._2F.._2Fsecret.txt');
    expect(safeFileName('report#1?.pdf', 'fallback')).toBe('report_1_.pdf');
  });

  it('falls back when nothing usable is left', () => {
    expect(safeFileName('..', 'fallback')).toBe('fallback');
    expect(safeFileName('dir/', 'fallback')).toBe('fallback');
    expect(safeFileName('   ', 'fallback')).toBe('fallback');
    expect(safeFileName(null, 'fallback')).toBe('fallback');
  });
});
