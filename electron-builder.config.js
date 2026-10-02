/**
 * Electron Builder Configuration
 * https://www.electron.build/configuration/configuration
 */
module.exports = {
  appId: 'com.resgrid.unit',
  productName: 'Resgrid Unit',
  copyright: 'Copyright © 2024 Resgrid',

  directories: {
    output: 'electron-dist',
    buildResources: 'assets',
  },

  files: [
    'dist/**/*',
    'electron/**/*',
    '!electron/__tests__/**',
    '!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}',
    '!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}',
    '!**/node_modules/.bin',
  ],

  // This app's scheme (the macOS Info.plist and the Linux desktop entry): legacy SSO returns to resgridunit://auth/callback.
  // macOS hands a packaged app only the schemes declared here.
  protocols: [{ name: 'Resgrid Unit', schemes: ['resgridunit'] }],

  // macOS configuration
  mac: {
    category: 'public.app-category.productivity',
    target: [
      { target: 'dmg', arch: ['x64', 'arm64'] },
      { target: 'zip', arch: ['x64', 'arm64'] },
    ],
    icon: 'assets/icon.png',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'electron/entitlements.mac.plist',
    entitlementsInherit: 'electron/entitlements.mac.plist',
    darkModeSupport: true,
  },

  dmg: {
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: 'link', path: '/Applications' },
    ],
    window: {
      width: 540,
      height: 380,
    },
  },

  // Windows configuration
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'portable', arch: ['x64'] },
    ],
    icon: 'assets/icon.ico',
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'assets/icon.ico',
    uninstallerIcon: 'assets/icon.ico',
    installerHeaderIcon: 'assets/icon.ico',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Resgrid Unit',
    license: 'LICENSE',
  },

  // Linux configuration
  linux: {
    target: [
      { target: 'AppImage', arch: ['x64'] },
      { target: 'deb', arch: ['x64'] },
      { target: 'rpm', arch: ['x64'] },
    ],
    category: 'Office',
    icon: 'assets/icon.png',
    maintainer: 'Resgrid <team@resgrid.com>',
    vendor: 'Resgrid',
    desktop: {
      entry: {
        Name: 'Resgrid Unit',
        Comment: 'Resgrid Unit Management Application',
        Category: 'Office;Utility;',
        StartupWMClass: 'resgrid-unit',
      },
    },
  },

  // Extra metadata
  extraMetadata: {
    main: 'electron/main.js',
  },
};
