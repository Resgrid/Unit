import { useColorScheme } from 'nativewind';
import React, { useCallback, useMemo, useRef } from 'react';
import { Linking, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

/** Light / dark theme color tokens used when no explicit override is provided */
const THEME_COLORS = {
  light: { text: '#1F2937', background: 'transparent' }, // gray-800
  dark: { text: '#E5E7EB', background: 'transparent' }, // gray-200
} as const;

export interface HtmlRendererProps {
  /** The raw HTML string to render inside the body tag */
  html: string;
  /** Optional inline style applied to the container */
  style?: StyleProp<ViewStyle>;
  /** Whether scrolling is enabled (default: false) */
  scrollEnabled?: boolean;
  /** Whether to show the vertical scroll indicator (default: false) */
  showsVerticalScrollIndicator?: boolean;
  /** Text color applied to the body – defaults to a theme-aware gray */
  textColor?: string;
  /** Background color applied to the body – defaults to a theme-aware gray */
  backgroundColor?: string;
  /** Optional React key for forcing re-renders */
  rendererKey?: string;
  /** Additional CSS injected inside the <style> block after the defaults */
  customCSS?: string;
  /** Callback when a link is tapped – links are opened via window.open on web */
  onLinkPress?: (url: string) => void;
  /** Whether JavaScript is enabled (ignored on web – sandbox controls this) */
  javaScriptEnabled?: boolean;
  /** Whether DOM storage is enabled (ignored on web) */
  domStorageEnabled?: boolean;
}

/**
 * Cross-platform HTML content renderer – **web & Electron** variant.
 *
 * Renders the HTML inside a sandboxed `<iframe>` using `srcDoc` so that
 * no external navigation is possible and the content is fully isolated.
 *
 * Text and background colors are theme-aware by default (light / dark)
 * but can be overridden via props for custom use-cases.
 */
export const HtmlRenderer: React.FC<HtmlRendererProps> = ({ html, style, scrollEnabled = false, showsVerticalScrollIndicator = false, textColor, backgroundColor, rendererKey, customCSS = '', onLinkPress }) => {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? THEME_COLORS.dark : THEME_COLORS.light;
  const resolvedTextColor = textColor ?? theme.text;
  const resolvedBgColor = backgroundColor ?? theme.background;

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // When onLinkPress is provided, inject a small script to intercept link clicks
  // and post a message to the parent window.
  const linkScript = onLinkPress
    ? `<script>
        document.addEventListener('click', function(e) {
          var anchor = e.target.closest('a');
          if (anchor && anchor.href) {
            e.preventDefault();
            window.parent.postMessage({ type: 'html-renderer-link', url: anchor.href }, '*');
          }
        });
      </script>`
    : '';

  const fullHtml = useMemo(
    () => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <style>
          html, body {
            margin: 0;
            padding: 0;
            overflow: ${scrollEnabled ? 'auto' : 'hidden'};
            background-color: transparent;
          }
          body {
            color: ${resolvedTextColor};
            font-family: system-ui, -apple-system, sans-serif;
            padding: 8px;
            font-size: 16px;
            line-height: 1.5;
            background-color: ${resolvedBgColor};
          }
          ${!showsVerticalScrollIndicator
        ? `
          ::-webkit-scrollbar { display: none; }
          body { -ms-overflow-style: none; scrollbar-width: none; }
          `
        : ''
      }
          * {
            max-width: 100%;
          }
          ${customCSS}
        </style>
      </head>
      <body>${html}${linkScript}</body>
    </html>
  `,
    [html, scrollEnabled, showsVerticalScrollIndicator, resolvedTextColor, resolvedBgColor, customCSS, linkScript]
  );

  // Listen for link-click messages from the iframe
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // Validate message origin/source - only accept messages from our trusted iframe
      if (event.data?.type === 'html-renderer-link' && event.data.url && event.source === iframeRef.current?.contentWindow) {
        if (onLinkPress) {
          onLinkPress(event.data.url);
        } else {
          Linking.openURL(event.data.url);
        }
      }
    },
    [onLinkPress]
  );

  React.useEffect(() => {
    if (!onLinkPress) return;
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLinkPress, handleMessage]);

  const flatStyle = StyleSheet.flatten([styles.container, style]) as Record<string, unknown>;

  // When onLinkPress is provided we need allow-scripts so the click-interceptor runs
  const sandboxValue = onLinkPress ? 'allow-same-origin allow-scripts' : 'allow-same-origin';

  const iframeStyle: React.CSSProperties = {
    border: 'none',
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    colorScheme: 'normal',
  };

  return (
    <View style={flatStyle} key={rendererKey}>
      <iframe
        ref={iframeRef}
        srcDoc={fullHtml}
        sandbox={sandboxValue}
        title="html-content"
        // @ts-expect-error -- allowTransparency is a valid HTML attribute but not in React's iframe types
        // eslint-disable-next-line react/no-unknown-property
        allowTransparency="true"
        style={iframeStyle}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'transparent',
  },
});
