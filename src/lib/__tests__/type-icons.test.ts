import { getTypeIconUrl } from '../type-icons';

describe('getTypeIconUrl', () => {
  it('returns an absolute http(s) URL, trimmed', () => {
    expect(getTypeIconUrl('https://api.example.test/api/v4/TypeIcons/Pins/Engine-responding?v=1')).toBe('https://api.example.test/api/v4/TypeIcons/Pins/Engine-responding?v=1');
    expect(getTypeIconUrl('  http://api.example.test/pin.png  ')).toBe('http://api.example.test/pin.png');
    expect(getTypeIconUrl('HTTPS://API.EXAMPLE.TEST/PIN.PNG')).toBe('HTTPS://API.EXAMPLE.TEST/PIN.PNG');
  });

  it.each([
    undefined,
    null,
    '',
    '   ',
    '/api/v4/TypeIcons/Pins/Engine-responding?v=1',
    'api.example.test/pin.png',
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'ftp://api.example.test/pin.png',
    'https://',
    'https://api.example.test/a pin.png',
  ])('returns null for %p', (value) => {
    expect(getTypeIconUrl(value)).toBeNull();
  });
});
