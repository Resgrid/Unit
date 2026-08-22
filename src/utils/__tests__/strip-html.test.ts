import { stripHtml } from '../strip-html';

describe('stripHtml', () => {
  it('returns an empty string for null, undefined and empty input', () => {
    expect(stripHtml(null)).toBe('');
    expect(stripHtml(undefined)).toBe('');
    expect(stripHtml('')).toBe('');
  });

  it('returns plain text unchanged', () => {
    expect(stripHtml('Structure fire at main street')).toBe('Structure fire at main street');
  });

  it('strips simple tags', () => {
    expect(stripHtml('<p>Structure fire</p>')).toBe('Structure fire');
    expect(stripHtml('<div><strong>MVA</strong> with injuries</div>')).toBe('MVA with injuries');
  });

  it('inserts whitespace where tags separated words', () => {
    expect(stripHtml('<p>Line one</p><p>Line two</p>')).toBe('Line one Line two');
    expect(stripHtml('First<br/>Second')).toBe('First Second');
  });

  it('decodes common named entities', () => {
    expect(stripHtml('<p>Smoke &amp; flames</p>')).toBe('Smoke & flames');
    expect(stripHtml('A&nbsp;B&quot;C&quot;')).toBe('A B"C"');
  });

  it('decodes entity-encoded markup before stripping, so encoded tags are removed too', () => {
    // Matches the sanitizer's decode-then-process order: a field that arrives fully
    // entity-encoded is real markup, not literal angle-bracket text.
    expect(stripHtml('Smoke &amp; flames &lt;visible&gt;')).toBe('Smoke & flames');
  });

  it('decodes numeric entities', () => {
    expect(stripHtml('Temp &#8211; 40&#176;')).toBe('Temp – 40°');
    expect(stripHtml('&#x41;&#66;')).toBe('AB');
  });

  it('collapses runs of whitespace and trims', () => {
    expect(stripHtml('  <p> Fire \n\t alarm  </p>  ')).toBe('Fire alarm');
  });

  it('removes script and style blocks including their content', () => {
    expect(stripHtml('<p>Safe</p><script>alert("x")</script><style>.a{color:red}</style>')).toBe('Safe');
  });

  it('handles entity-encoded markup (no literal tags in the input)', () => {
    expect(stripHtml('&lt;p&gt;Encoded nature&lt;/p&gt;')).toBe('Encoded nature');
  });

  it('handles attributes and self-closing tags', () => {
    expect(stripHtml('<a href="https://example.com" title="x">Link text</a>')).toBe('Link text');
    expect(stripHtml('<img src="x.png" alt="pic"/>after')).toBe('after');
  });
});
