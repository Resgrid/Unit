import base64 from 'react-native-base64';

/**
 * Reinterpret a byte string as UTF-8.
 *
 * react-native-base64's decode() returns one character per byte (latin1), so a
 * multi-byte claim such as a name with an accent arrives mojibake'd ("Tëst"
 * instead of "Tëst"). Percent-encoding each byte and letting decodeURIComponent
 * reassemble the sequences recovers the original text. Falls back to the raw
 * byte string if the bytes are not valid UTF-8, so this can never throw where
 * the previous latin1 behavior merely garbled.
 */
const bytesToUtf8 = (binary: string): string => {
  try {
    return decodeURIComponent(Array.from(binary, (char) => `%${(char.charCodeAt(0) & 0xff).toString(16).padStart(2, '0')}`).join(''));
  } catch {
    return binary;
  }
};

/**
 * Decode the payload (second segment) of a JWT to its JSON string.
 *
 * JWT segments are base64url-encoded (RFC 7515): the alphabet uses '-' and '_'
 * instead of '+' and '/', and drops '=' padding. react-native-base64's decode()
 * only understands the standard alphabet and throws on '-'/'_', so normalize to
 * standard base64 and re-pad before decoding.
 */
export const decodeJwtPayload = (token: string): string => {
  const segment = token.split('.')[1];
  if (!segment) {
    throw new Error('Invalid JWT: missing payload segment');
  }

  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return bytesToUtf8(base64.decode(padded));
};

/**
 * Best-effort extraction of a JWT's `exp` claim as epoch milliseconds.
 * Returns null when the token is not a decodable JWT or carries no numeric exp.
 */
export const getJwtExpiryMs = (token: string): number | null => {
  try {
    const payload = JSON.parse(decodeJwtPayload(token)) as { exp?: unknown };
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp) ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};
