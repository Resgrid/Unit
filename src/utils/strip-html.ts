import { decodeHtmlEntities, decodeHtmlEntitiesIfEncoded } from './html-entities';

/**
 * Converts an HTML fragment to plain text for previews (e.g. call Nature inside
 * list cards): drops script/style blocks, strips tags, decodes common entities
 * and collapses whitespace to single spaces.
 *
 * Rendering these fields through the WebView-backed HtmlRenderer is reserved for
 * detail screens — a WebView per list row is far too heavy.
 */
export const stripHtml = (html: string | null | undefined): string => {
  if (!html) {
    return '';
  }

  // Some fields arrive entity-encoded (`&lt;p&gt;…`) — decode first so the tag
  // stripper below sees real markup instead of literal `&lt;p&gt;` text.
  const decodedMarkup = decodeHtmlEntitiesIfEncoded(html);

  const withoutBlocks = decodedMarkup.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
  const withoutTags = withoutBlocks.replace(/<[^>]*>/g, ' ');
  const decodedText = decodeHtmlEntities(withoutTags);

  return decodedText.replace(/\s+/g, ' ').trim();
};
