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
    const listener = (event, data) => callback(data);
    ipcRenderer.on('notification-clicked', listener);
    // Return a cleanup function that removes only this specific listener
    return () => {
      ipcRenderer.removeListener('notification-clicked', listener);
    };
  },

  // Platform queries
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  // Desktop push (push-receiver.js): the main process holds the FCM connection; the page registers its token.
  pushStart: (firebaseConfig) => ipcRenderer.invoke('push:start', firebaseConfig),
  pushStop: (forget) => ipcRenderer.invoke('push:stop', forget),
  pushTakePendingClick: () => ipcRenderer.invoke('push:take-pending-click'),
  onPushReceived: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('push:received', listener);
    return () => ipcRenderer.removeListener('push:received', listener);
  },
  onPushNotificationClick: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('push:notification-click', listener);
    return () => ipcRenderer.removeListener('push:notification-click', listener);
  },

  // Brokered SSO: a one-time loopback listener receives the broker's return (see sso-loopback.js)
  ssoListen: () => ipcRenderer.invoke('sso:listen'),
  ssoOpen: (id, authorizeUrl) => ipcRenderer.invoke('sso:open', id, authorizeUrl),
  ssoCancel: (id) => ipcRenderer.invoke('sso:cancel', id),

  // Legacy SSO: the main process runs the provider's sign-in in the member's browser and takes the return on this app's
  // scheme (see legacy-sso.js). OIDC answers with the id_token; SAML with the relay's link, for the page to check.
  legacySsoOidc: (authority, clientId, reauthenticate) => ipcRenderer.invoke('legacy-sso:oidc', authority, clientId, reauthenticate),
  legacySsoSaml: (signInUrl) => ipcRenderer.invoke('legacy-sso:saml', signInUrl),
  legacySsoCancel: () => ipcRenderer.invoke('legacy-sso:cancel'),

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
