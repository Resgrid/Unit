// Axios interceptor setup

import { useShallow } from 'zustand/react/shallow';

import useAuthStore from '../../stores/auth/store';

export { default as useAuthStore } from '../../stores/auth/store';
export * from './api';
export * from './types';

// Utility hooks and selectors
export const useAuth = () => {
  const { accessToken, status, error, login, ssoLogin, logout, hydrate } = useAuthStore(
    useShallow((state) => ({
      accessToken: state.accessToken,
      status: state.status,
      error: state.error,
      login: state.login,
      ssoLogin: state.ssoLogin,
      logout: state.logout,
      hydrate: state.hydrate,
    }))
  );
  return {
    isAuthenticated: !!accessToken,
    isLoading: status === 'loading',
    error,
    login,
    ssoLogin,
    logout,
    status,
    hydrate,
  };
};
