/* eslint-disable no-undef */
const { app, BrowserWindow, ipcMain, Notification, nativeTheme, Menu, protocol, net, shell } = require('electron');
const { registerSsoLoopback } = require('./sso-loopback');
const { registerLegacySso } = require('./legacy-sso');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Register custom protocol scheme before app is ready
// This allows serving the Expo web export with absolute paths (/_expo/static/...)
// via a custom protocol instead of file://, which breaks absolute path resolution.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow = null;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// This app's own scheme, as the mobile app has it: legacy SSO returns to resgridunit://auth/callback (legacy-sso.js).
const APP_SCHEME = 'resgridunit';
if (process.defaultApp && process.argv.length >= 2) {
  // Unpackaged (electron .): the OS must start Electron with this app's entry script.
  app.setAsDefaultProtocolClient(APP_SCHEME, process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient(APP_SCHEME);
}

function focusMainWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
}

// Legacy SSO: the provider and the SAML relay return through the OS to this app's scheme.
const legacySso = registerLegacySso(ipcMain, {
  scheme: APP_SCHEME,
  openExternal: (url) => shell.openExternal(url),
  // The main process's network stack: the system's proxy settings, and no Origin header on the provider's token request.
  fetch: (url, init) => net.fetch(url, init),
  focus: focusMainWindow,
});

// One instance: on Windows and Linux the OS starts a second instance with the scheme's link, which hands it to this one
// and quits. A second launch from the dock or start menu shows this window.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    focusMainWindow();
    const link = legacySso.linkIn(argv);
    if (link) {
      legacySso.handleLink(link);
    }
  });
}

// macOS hands this app its scheme's links here.
app.on('open-url', (event, url) => {
  event.preventDefault();
  legacySso.handleLink(url);
});

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    // MacOS: use hidden title bar with traffic lights
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    // Windows/Linux: show frame
    frame: process.platform !== 'darwin',
    // Set the background color to match the app theme
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1a1a' : '#ffffff',
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false, // Don't show until ready
  });

  // Load the app
  if (isDev) {
    // In development, load from the Expo dev server
    mainWindow.loadURL('http://localhost:8081');
  } else {
    // In production, load via the custom app:// protocol
    // which correctly resolves absolute paths (/_expo/static/...) from the dist directory
    mainWindow.loadURL('app://bundle/index.html');
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // Open DevTools in development
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links — only http(s) may be opened externally. Other
  // schemes (file:, javascript:, custom protocols) are denied: a crafted link
  // inside rendered content could otherwise escape to the OS handler.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      require('electron').shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

// Build application menu
function createMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    // App Menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }],
          },
        ]
      : []),
    // File Menu
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }],
    },
    // Edit Menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [{ role: 'pasteAndMatchStyle' }, { role: 'delete' }, { role: 'selectAll' }] : [{ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }]),
      ],
    },
    // View Menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    // Window Menu
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, ...(isMac ? [{ type: 'separator' }, { role: 'front' }, { type: 'separator' }, { role: 'window' }] : [{ role: 'close' }])],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers for notifications
ipcMain.handle('show-notification', async (event, { title, body, data }) => {
  if (!Notification.isSupported()) {
    console.warn('Notifications are not supported on this system');
    return false;
  }

  const notification = new Notification({
    title: title || 'Resgrid Unit',
    body: body || '',
    silent: false,
    icon: path.join(__dirname, '../assets/icon.png'),
  });

  notification.on('click', () => {
    // Focus the window
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
      // Send notification data to renderer
      mainWindow.webContents.send('notification-clicked', data);
    }
  });

  notification.show();
  return true;
});

// Brokered SSO returns to a one-time loopback listener; the provider opens in the member's own browser.
registerSsoLoopback(ipcMain, {
  openExternal: (url) => shell.openExternal(url),
  focus: focusMainWindow,
});

// Handle getting platform info
ipcMain.handle('get-platform', () => {
  return process.platform;
});

// Handle app ready
app.whenReady().then(() => {
  // A second instance only hands its link to the first, then quits.
  if (!gotSingleInstanceLock) {
    return;
  }

  // Register custom protocol handler for serving the Expo web export
  // This resolves absolute paths like /_expo/static/js/... from the dist directory
  const distPath = path.join(__dirname, '..', 'dist');
  const resolvedDist = path.resolve(distPath);

  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    // Decode the pathname, join with base path, then canonicalize to prevent directory traversal
    const joinedPath = path.join(distPath, decodeURIComponent(url.pathname));
    const resolvedPath = path.resolve(joinedPath);

    // Security check: ensure resolved path is within distPath to prevent directory traversal
    let filePath;
    if (!resolvedPath.startsWith(resolvedDist + path.sep) && resolvedPath !== resolvedDist) {
      // Path escapes distPath - fall back to index.html
      filePath = path.join(resolvedDist, 'index.html');
    } else {
      filePath = resolvedPath;

      // If the path points to a directory or file doesn't exist, fall back to index.html
      // This supports SPA client-side routing
      try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          filePath = path.join(resolvedDist, 'index.html');
        }
      } catch {
        // File not found - serve index.html for client-side routing
        filePath = path.join(resolvedDist, 'index.html');
      }
    }

    return net.fetch(pathToFileURL(filePath).toString());
  });

  createMenu();
  createWindow();

  // On macOS, re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
