const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform information
  platform: process.platform,
  isElectron: true,

  // Notification methods
  showNotification: (options) => ipcRenderer.invoke('show-notification', options),
  onNotificationClicked: (callback) => {
    ipcRenderer.on('notification-clicked', (event, data) => callback(data));
    // Return a cleanup function
    return () => {
      ipcRenderer.removeAllListeners('notification-clicked');
    };
  },

  // Platform queries
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  // Window controls (for custom title bar if needed)
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),

  // Version info
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
});

// Log that preload script has been loaded
console.log('Electron preload script loaded');
