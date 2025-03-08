import React, { useEffect } from 'react';

import { logger } from '@/lib/logging';
import useAuthStore from '@/stores/auth/store';
import { useSignalRStore } from '@/stores/signalr/signalr-store';

interface SignalRProviderProps {
  children: React.ReactNode;
}

export const SignalRProvider: React.FC<SignalRProviderProps> = ({ children }) => {
  const { connect, disconnect, isConnected, error } = useSignalRStore();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());

  useEffect(() => {
    if (isAuthenticated && !isConnected) {
      logger.info({
        message: 'Connecting to SignalR hubs',
      });
      connect();
    } else if (!isAuthenticated && isConnected) {
      logger.info({
        message: 'Disconnecting from SignalR hubs',
      });
      disconnect();
    }

    return () => {
      if (isConnected) {
        disconnect();
      }
    };
  }, [isAuthenticated, isConnected, connect, disconnect]);

  if (error) {
    logger.error({
      message: 'SignalR connection error',
      context: { error },
    });
  }

  return <>{children}</>;
};
