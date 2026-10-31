import { htmlToText, parseCoordinates, withoutRedacted } from '@/lib/contacts/format';
import { type ContactResultData, ContactType } from '@/models/v4/contacts/contactResultData';

it('turns web-editor rich text into readable plain text', () => {
  expect(htmlToText('<p>Knox box at <b>north</b> door</p><p>Gate &amp; code</p><ul><li>Hydrant</li></ul><script>alert(1)</script>')).toBe('Knox box at north door\nGate & code\n• Hydrant');
  expect(htmlToText(null)).toBe('');
});

it('drops a script that only forms once an inner script is removed', () => {
  expect(htmlToText('Gate<scr<script>x</script>ipt>alert(1)</script> code')).toBe('Gate code');
});

it('parses coordinates so a point routes as a point and anything else as an address', () => {
  expect(parseCoordinates('39.7392, -104.9903')).toEqual({ latitude: 39.7392, longitude: -104.9903 });
  expect(parseCoordinates('not a place')).toBeNull();
  expect(parseCoordinates('95, 10')).toBeNull();
});

it('removes withheld values and names the fields so the sheet never shows or dials the sentinel', () => {
  const contact = { ContactId: 'c-1', ContactType: ContactType.Person, FirstName: 'Ana', CellPhoneNumber: 'REDACTED', Email: 'REDACTED', IsDeleted: false } as unknown as ContactResultData;
  const shown = withoutRedacted(contact);
  expect(shown.CellPhoneNumber).toBeUndefined();
  expect(shown.Email).toBeUndefined();
  expect(shown.FirstName).toBe('Ana');
  expect(shown.WithheldFields).toEqual(['CellPhoneNumber', 'Email']);
  expect(contact.CellPhoneNumber).toBe('REDACTED');
});
