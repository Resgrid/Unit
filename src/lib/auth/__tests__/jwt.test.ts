import { describe, expect, it } from '@jest/globals';

import { decodeJwtPayload, getJwtExpiryMs } from '../jwt';

/** Build a JWT whose payload is base64url-encoded (RFC 7515): '-'/'_' alphabet, no padding. */
const makeJwt = (payload: Record<string, unknown>): string => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `header.${encoded}.signature`;
};

describe('decodeJwtPayload', () => {
  it('decodes a payload containing base64url characters (- and _)', () => {
    // These byte sequences force '+' and '/' in standard base64, which become
    // '-' and '_' in base64url — the exact input react-native-base64 rejects.
    const payload = { sub: 'user-1', name: 'Unit ~~~ ûÿ', exp: 1893456000 };
    const token = makeJwt(payload);

    // Guard: the fixture really does exercise the base64url alphabet.
    expect(token.split('.')[1]).toMatch(/[-_]/);

    expect(JSON.parse(decodeJwtPayload(token))).toMatchObject({ sub: 'user-1', name: 'Unit ~~~ ûÿ', exp: 1893456000 });
  });

  // react-native-base64 hands back one character per byte (latin1), so without
  // reinterpreting those bytes as UTF-8 every non-ASCII display name arrives
  // mojibake'd — "Tëst" as "TÃ«st". The app ships nine non-English locales, so
  // departments really do have names outside ASCII.
  it.each([
    ['Latin accents', 'Tëst Ünit Nº3'],
    ['Cyrillic', 'Пожежна частина 7'],
    ['Greek', 'Πυροσβεστική Μονάδα'],
    ['Arabic', 'وحدة الإطفاء'],
    ['four-byte sequences', 'Station 🚒 Alpha'],
  ])('round-trips %s in a name claim', (_label, name) => {
    expect(JSON.parse(decodeJwtPayload(makeJwt({ sub: 'user-1', name })))).toMatchObject({ name });
  });

  it('falls back to the raw bytes rather than throwing on invalid UTF-8', () => {
    // 0x80 is a bare continuation byte — not a legal UTF-8 sequence start.
    const encoded = Buffer.from([0x80, 0x41]).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(() => decodeJwtPayload(`header.${encoded}.signature`)).not.toThrow();
  });

  it('decodes an unpadded payload (base64url drops = padding)', () => {
    const token = makeJwt({ sub: 'abc' });
    expect(token.split('.')[1]).not.toContain('=');
    expect(JSON.parse(decodeJwtPayload(token))).toEqual({ sub: 'abc' });
  });

  it('throws when the token has no payload segment', () => {
    expect(() => decodeJwtPayload('not-a-jwt')).toThrow('Invalid JWT: missing payload segment');
  });
});

describe('getJwtExpiryMs', () => {
  it('returns the exp claim converted to epoch milliseconds', () => {
    expect(getJwtExpiryMs(makeJwt({ sub: 'a', exp: 1893456000 }))).toBe(1893456000 * 1000);
  });

  it('reads exp from a payload that uses base64url characters', () => {
    const token = makeJwt({ sub: 'user-1', name: 'Unit ~~~ ûÿ', exp: 1893456000 });
    expect(getJwtExpiryMs(token)).toBe(1893456000 * 1000);
  });

  it('returns null when there is no numeric exp claim', () => {
    expect(getJwtExpiryMs(makeJwt({ sub: 'a' }))).toBeNull();
    expect(getJwtExpiryMs(makeJwt({ sub: 'a', exp: 'soon' }))).toBeNull();
  });

  it('returns null for an opaque (non-JWT) token instead of throwing', () => {
    expect(getJwtExpiryMs('opaque-access-token')).toBeNull();
    expect(getJwtExpiryMs('')).toBeNull();
  });
});
