/* eslint-disable no-undef */
const { app, BrowserWindow, ipcMain, Notification, nativeTheme, Menu, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');

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

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
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

// Handle getting platform info
ipcMain.handle('get-platform', () => {
  return process.platform;
});

// Handle app ready
app.whenReady().then(() => {
  // Register custom protocol handler for serving the Expo web export
  // This resolves absolute paths like /_expo/static/js/... from the dist directory
  const distPath = path.join(__dirname, '..', 'dist');

  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    // Decode the pathname and resolve to a file in dist/
    let filePath = path.join(distPath, decodeURIComponent(url.pathname));

    // If the path points to a directory or file doesn't exist, fall back to index.html
    // This supports SPA client-side routing
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        filePath = path.join(distPath, 'index.html');
      }
    } catch {
      // File not found - serve index.html for client-side routing
      filePath = path.join(distPath, 'index.html');
    }

    return net.fetch('file://' + filePath);
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

// Handle deep links (for future use)
app.on('open-url', (event, url) => {
  event.preventDefault();
  // Handle the URL
  console.log('Deep link received:', url);
});
