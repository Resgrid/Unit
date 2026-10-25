/**
 * An icon URL from the server (a department upload, or a map pin's status/priority-coloured `PinIconUrl`) when it is
 * usable, otherwise null. Only absolute http(s) URLs are accepted: the server sends an absolute, anonymous, immutable
 * image URL, and anything else (blank, relative, another scheme) is treated as "none".
 */
export const getTypeIconUrl = (iconUrl?: string | null): string | null => {
  if (typeof iconUrl !== 'string') return null;
  const trimmed = iconUrl.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : null;
};
