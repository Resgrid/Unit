// Characters that separate path segments or change how a file URI is read (`%` escapes, `#` and `?`
// start a fragment or query), plus the ones file systems refuse and control characters.
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARACTERS = /[\\/:*?"<>|#%\u0000-\u001f\u007f]/g;

/**
 * A server-supplied file name reduced to one safe path segment, so writing it under an app directory
 * can never land outside that directory. Anything left empty or made only of dots becomes `fallback`.
 */
export const safeFileName = (name: string | null | undefined, fallback: string): string => {
  const lastSegment = (name ?? '').split(/[\\/]/).pop() ?? '';
  const cleaned = lastSegment.replace(UNSAFE_CHARACTERS, '_').trim();
  return /^\.*$/.test(cleaned) ? fallback : cleaned;
};
