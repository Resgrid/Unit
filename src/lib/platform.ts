import { Platform } from 'react-native';

/**
 * Platform detection utilities for cross-platform development
 */

// Check if running in a web browser
export const isWeb = Platform.OS === 'web';

// Check if running in Electron (desktop app wrapped around web)
// Prefer preload-exposed electronAPI for contextIsolation-enabled environments
export const isElectron = 
  typeof window !== 'undefined' && 
  (!!(window as any).electronAPI || window.process?.type === 'renderer');

// Check if running on a desktop platform (Electron or native desktop)
export const isDesktop = isElectron || Platform.OS === 'macos' || Platform.OS === 'windows';

// Check if running on native mobile platforms
export const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

// Check if running on iOS
export const isIOS = Platform.OS === 'ios';

// Check if running on Android
export const isAndroid = Platform.OS === 'android';

// Get the current platform name
export const platformName = (): string => {
  if (isElectron) {
    // Detect Electron's underlying OS
    const electronPlatform = (window as any).electronAPI?.platform;
    if (electronPlatform === 'darwin') return 'macOS (Electron)';
    if (electronPlatform === 'win32') return 'Windows (Electron)';
    if (electronPlatform === 'linux') return 'Linux (Electron)';
    return 'Electron';
  }

  const os = Platform.OS;
  switch (os) {
    case 'ios':
      return 'iOS';
    case 'android':
      return 'Android';
    case 'web':
      return 'Web';
    case 'macos':
      return 'macOS';
    case 'windows':
      return 'Windows';
    default:
      return os;
  }
};

// Augment Window interface for Electron API
declare global {
  interface Window {
    process?: {
      type?: string;
    };
    electronAPI?: {
      showNotification: (options: { title: string; body: string; data: any }) => Promise<boolean>;
      onNotificationClicked: (callback: (data: any) => void) => void;
      platform: string;
      isElectron: boolean;
    };
  }
}
