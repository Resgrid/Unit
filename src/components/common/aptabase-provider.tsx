import { Env } from '@env';
import Countly from 'countly-sdk-react-native-bridge';
import React, { useRef } from 'react';

import { logger } from '@/lib/logging';
import { countlyService } from '@/services/analytics.service';

interface CountlyProviderWrapperProps {
  appKey: string;
  serverURL: string;
  children: React.ReactNode;
}

export const CountlyProviderWrapper: React.FC<CountlyProviderWrapperProps> = ({ appKey, serverURL, children }) => {
  const initializationAttempted = useRef(false);
  const [initializationFailed, setInitializationFailed] = React.useState(false);

  React.useEffect(() => {
    // Only attempt initialization once
    if (initializationAttempted.current) return;
    initializationAttempted.current = true;

    const initializeCountly = async () => {
      logger.info({
        message: 'Countly provider initialization starting',
        context: {
          appKey: appKey ? `${appKey.substring(0, 8)}...` : 'NOT PROVIDED',
          serverURL: serverURL || 'NOT PROVIDED',
          envAppKey: Env.COUNTLY_APP_KEY ? `${Env.COUNTLY_APP_KEY.substring(0, 8)}...` : 'NOT SET',
          envServerURL: Env.COUNTLY_SERVER_URL || 'NOT SET',
        },
      });

      // Check if analytics is already disabled due to previous errors
      if (countlyService.isAnalyticsDisabled()) {
        logger.info({
          message: 'Countly provider skipped - service is disabled',
          context: countlyService.getStatus(),
        });
        setInitializationFailed(true);
        return;
      }

      try {
        // Initialize Countly with proper configuration
        const keyToUse = appKey || Env.COUNTLY_APP_KEY;
        const urlToUse = serverURL || Env.COUNTLY_SERVER_URL;

        logger.info({
          message: 'Countly configuration check',
          context: {
            keyToUse: keyToUse ? `${keyToUse.substring(0, 8)}...` : 'MISSING',
            urlToUse: urlToUse || 'MISSING',
            hasAppKey: !!keyToUse,
            hasServerURL: !!urlToUse,
          },
        });

        if (!keyToUse || !urlToUse) {
          logger.warn({
            message: 'Countly initialization skipped - missing configuration',
            context: {
              hasAppKey: !!keyToUse,
              hasServerURL: !!urlToUse,
            },
          });
          setInitializationFailed(true);
          return;
        }

        logger.info({
          message: 'Attempting Countly initialization',
          context: { appKey: keyToUse.substring(0, 8) + '...', serverURL: urlToUse },
        });

        // Initialize Countly with the modern React Native SDK pattern  
        Countly.init(keyToUse, urlToUse, null);
        logger.info({ message: 'Countly.init() completed' });

        // Enable debugging for Countly SDK
        Countly.setLoggingEnabled(true);
        logger.info({ message: 'Countly logging enabled' });

        // Enable crash reporting
        Countly.enableCrashReporting();
        logger.info({ message: 'Countly crash reporting enabled' });

        // Start Countly
        Countly.start();
        logger.info({ message: 'Countly.start() completed' });

        // Test a simple event right after initialization
        setTimeout(() => {
          try {
            logger.info({ message: 'Sending test initialization event' });
            Countly.events.recordEvent('countly_initialized', { initialized_at: new Date().toISOString() }, 1);
            logger.info({ message: 'Test initialization event sent' });
          } catch (testError) {
            logger.error({ message: 'Failed to send test initialization event', context: { error: String(testError) } });
          }
        }, 1000);

        logger.info({
          message: 'Countly provider initialized successfully',
          context: {
            appKey: keyToUse.substring(0, 8) + '...',
            serverURL: urlToUse,
            serviceStatus: countlyService.getStatus(),
          },
        });
      } catch (error) {
        logger.error({
          message: 'Countly provider initialization failed',
          context: {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
        });

        // Handle the error through the service
        countlyService.reset();
        setInitializationFailed(true);
      }
    };

    initializeCountly();

    return () => {
      // Cleanup if needed - Countly doesn't require explicit cleanup
    };
  }, [appKey, serverURL]);

  // Always render children - Countly doesn't require a provider wrapper around the app
  return <>{children}</>;
};

// Keep backward compatibility - update signature to match Countly requirements
interface AptabaseProviderWrapperProps {
  appKey: string;
  serverURL?: string;
  children: React.ReactNode;
}

export const AptabaseProviderWrapper: React.FC<AptabaseProviderWrapperProps> = ({ appKey, serverURL, children }) => {
  return (
    <CountlyProviderWrapper appKey={appKey} serverURL={serverURL || Env.COUNTLY_SERVER_URL}>
      {children}
    </CountlyProviderWrapper>
  );
};
