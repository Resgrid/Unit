// Mock for expo-web-browser
const maybeCompleteAuthSession = jest.fn(() => ({ type: 'success' }));
const openBrowserAsync = jest.fn(() => Promise.resolve({ type: 'dismiss' }));
const openAuthSessionAsync = jest.fn(() => Promise.resolve({ type: 'dismiss' }));
const dismissBrowser = jest.fn();

module.exports = {
  maybeCompleteAuthSession,
  openBrowserAsync,
  openAuthSessionAsync,
  dismissBrowser,
  __esModule: true,
};
