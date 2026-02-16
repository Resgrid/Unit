import { useColorScheme } from 'nativewind';
import React from 'react';
import { Linking, type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import WebView from 'react-native-webview';

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
  /** Callback when a link is tapped – if provided, external links are opened via
   *  this callback instead of in-webview navigation. Falls back to Linking.openURL. */
  onLinkPress?: (url: string) => void;
  /** Whether JavaScript is enabled in the webview (default: false for security) */
  javaScriptEnabled?: boolean;
  /** Whether DOM storage is enabled in the webview (default: false) */
  domStorageEnabled?: boolean;
}

/**
 * Cross-platform HTML content renderer.
 *
 * On iOS and Android this delegates to `react-native-webview`.
 * On web and Electron the `.web.tsx` variant is resolved instead.
 *
 * Text and background colors are theme-aware by default (light / dark)
 * but can be overridden via props for custom use-cases.
 */
export const HtmlRenderer: React.FC<HtmlRendererProps> = ({
  html,
  style,
  scrollEnabled = false,
  showsVerticalScrollIndicator = false,
  textColor,
  backgroundColor,
  rendererKey,
  customCSS = '',
  onLinkPress,
  javaScriptEnabled = false,
  domStorageEnabled = false,
}) => {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? THEME_COLORS.dark : THEME_COLORS.light;
  const resolvedTextColor = textColor ?? theme.text;
  const resolvedBgColor = backgroundColor ?? theme.background;

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <style>
          body {
            color: ${resolvedTextColor};
            font-family: system-ui, -apple-system, sans-serif;
            margin: 0;
            padding: 8px;
            font-size: 16px;
            line-height: 1.5;
            background-color: ${resolvedBgColor};
          }
          * {
            max-width: 100%;
          }
          ${customCSS}
        </style>
      </head>
      <body>${html}</body>
    </html>
  `;

  const handleLinkPress = onLinkPress ?? ((url: string) => Linking.openURL(url));

  return (
    <WebView
      key={rendererKey}
      style={StyleSheet.flatten([styles.container, style])}
      originWhitelist={onLinkPress ? ['about:'] : ['*']}
      scrollEnabled={scrollEnabled}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      source={{ html: fullHtml }}
      androidLayerType="software"
      javaScriptEnabled={javaScriptEnabled}
      domStorageEnabled={domStorageEnabled}
      {...(onLinkPress
        ? {
            onShouldStartLoadWithRequest: (request: { url: string }) => {
              if (request.url.startsWith('about:') || request.url.startsWith('data:')) {
                return true;
              }
              handleLinkPress(request.url);
              return false;
            },
            onNavigationStateChange: (navState: { url: string }) => {
              if (navState.url && !navState.url.startsWith('about:') && !navState.url.startsWith('data:')) {
                handleLinkPress(navState.url);
              }
            },
          }
        : {})}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'transparent',
  },
});
