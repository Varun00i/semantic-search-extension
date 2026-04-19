import { cleanHtmlText, decodeHtmlEntities } from '../src/utils/html-cleaner';

describe('cleanHtmlText', () => {
  it('strips HTML tags', () => {
    const html = '<p>Hello <b>world</b></p>';
    const clean = cleanHtmlText(html);
    expect(clean).toContain('Hello');
    expect(clean).toContain('world');
    expect(clean).not.toContain('<p>');
    expect(clean).not.toContain('<b>');
  });

  it('removes script and style content', () => {
    const html = '<div>Text<script>alert("x")</script><style>.a{}</style>More</div>';
    const clean = cleanHtmlText(html);
    expect(clean).toContain('Text');
    expect(clean).toContain('More');
    expect(clean).not.toContain('alert');
    expect(clean).not.toContain('.a{}');
  });

  it('collapses whitespace', () => {
    const html = 'Hello     world\n\n\n\ntest';
    const clean = cleanHtmlText(html);
    expect(clean).not.toMatch(/\s{3,}/);
  });

  it('returns empty string for empty input', () => {
    expect(cleanHtmlText('')).toBe('');
  });

  it('handles plain text without tags', () => {
    const text = 'Just plain text here';
    expect(cleanHtmlText(text)).toBe(text);
  });
});

describe('decodeHtmlEntities', () => {
  it('decodes common entities', () => {
    expect(decodeHtmlEntities('&amp;')).toBe('&');
    expect(decodeHtmlEntities('&lt;')).toBe('<');
    expect(decodeHtmlEntities('&gt;')).toBe('>');
    expect(decodeHtmlEntities('&quot;')).toBe('"');
    expect(decodeHtmlEntities('&#39;')).toBe("'");
  });

  it('decodes numeric entities', () => {
    expect(decodeHtmlEntities('&#65;')).toBe('A');
    expect(decodeHtmlEntities('&#x41;')).toBe('A');
  });

  it('leaves unrecognized entities as-is', () => {
    const text = 'Hello & world';
    expect(decodeHtmlEntities(text)).toBe('Hello & world');
  });
});
