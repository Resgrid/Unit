import fs from 'fs';
import path from 'path';

/**
 * Guards against test suites that mock away the very module they claim to cover.
 *
 * A file at `<dir>/__tests__/<name>.test.tsx` whose subject is `<dir>/<name>.tsx`
 * must not call `jest.mock('../<name>')`. Doing so replaces the subject with a
 * hand-written stand-in, so the suite asserts against the stand-in and executes
 * none of the production code — it passes forever, including when the real
 * component is broken or deleted.
 *
 * Mocking a subject's *dependencies* is normal and correct; only the subject
 * itself is off limits. That is why the check is narrow: it fires solely when a
 * test mocks the sibling module it is named after.
 *
 * A sweep on 2026-08-21 found eight such suites. Four covered production code
 * that nothing else touched (login-form, call-images-modal,
 * full-screen-image-modal, full-screen-location-picker) and were rewritten
 * against the real components — which immediately surfaced six real bugs. The
 * four below still have a sibling suite exercising the real code, so they are
 * misleading rather than dangerous. They are listed here as known debt: the list
 * may shrink, never grow.
 */
const KNOWN_SELF_MOCKING_SUITES = [
  'src/components/notifications/__tests__/NotificationInbox.test.tsx',
  'src/components/maps/__tests__/pin-detail-modal.test.tsx',
  'src/components/calls/__tests__/call-notes-modal.test.tsx',
  'src/components/calls/__tests__/call-detail-menu.test.tsx',
];

const SRC = path.join(__dirname, '..');
const SUBJECT_EXTENSIONS = ['.ts', '.tsx'];

const collectTestFiles = (dir: string, found: string[] = []): string[] => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTestFiles(full, found);
    } else if (/\.(test|spec)\.tsx?$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
};

/**
 * Strip comments so a suite that merely *describes* the anti-pattern in prose
 * (as the rewritten login-form suite does) is not mistaken for one committing it.
 */
const stripComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Returns the repo-relative path of a suite that mocks its own subject, or null. */
const findSelfMock = (testFile: string): string | null => {
  const dir = path.dirname(testFile);
  if (path.basename(dir) !== '__tests__') {
    return null;
  }

  const subjectName = path.basename(testFile).replace(/\.(test|spec)\.tsx?$/, '');
  const subjectDir = path.dirname(dir);
  const subjectExists = SUBJECT_EXTENSIONS.some((ext) => fs.existsSync(path.join(subjectDir, `${subjectName}${ext}`)));
  if (!subjectExists) {
    return null;
  }

  const source = stripComments(fs.readFileSync(testFile, 'utf8'));
  // Match jest.mock('../<subject>') / jest.doMock("../<subject>"), with or without a factory.
  const selfMock = new RegExp(String.raw`jest\.(?:do)?[Mm]ock\(\s*['"\`]\.\./${subjectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`);
  return selfMock.test(source) ? path.relative(path.join(SRC, '..'), testFile) : null;
};

describe('test suites cover their real subject', () => {
  const testFiles = collectTestFiles(SRC);

  it('finds test files to check', () => {
    expect(testFiles.length).toBeGreaterThan(100);
  });

  it('has no self-mocking suite outside the known-debt list', () => {
    const offenders = testFiles.map(findSelfMock).filter((entry): entry is string => entry !== null);
    const unexpected = offenders.filter((entry) => !KNOWN_SELF_MOCKING_SUITES.includes(entry));

    expect(unexpected).toEqual([]);
  });

  it('keeps the known-debt list honest — entries that no longer self-mock must be removed', () => {
    const offenders = new Set(testFiles.map(findSelfMock).filter((entry): entry is string => entry !== null));
    const staleEntries = KNOWN_SELF_MOCKING_SUITES.filter((entry) => !offenders.has(entry));

    expect(staleEntries).toEqual([]);
  });
});
