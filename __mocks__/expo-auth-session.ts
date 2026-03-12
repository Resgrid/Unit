// Mock for expo-auth-session
const mockExchangeCodeAsync = jest.fn();
const mockMakeRedirectUri = jest.fn(() => 'resgridunit://auth/callback');
const mockUseAutoDiscovery = jest.fn(() => ({
  authorizationEndpoint: 'https://idp.example.com/authorize',
  tokenEndpoint: 'https://idp.example.com/token',
}));
const mockUseAuthRequest = jest.fn(() => [
  { codeVerifier: 'test-verifier' },
  null,
  jest.fn(),
]);

module.exports = {
  makeRedirectUri: mockMakeRedirectUri,
  useAutoDiscovery: mockUseAutoDiscovery,
  useAuthRequest: mockUseAuthRequest,
  exchangeCodeAsync: mockExchangeCodeAsync,
  ResponseType: { Code: 'code' },
  __esModule: true,
};
