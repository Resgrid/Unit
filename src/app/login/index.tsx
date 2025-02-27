import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';

import type { LoginFormProps } from '@/app/login/login-form';
import { FocusAwareStatusBar } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { logger } from '@/lib/logging';

import { LoginForm } from './login-form';

export default function Login() {
  const router = useRouter();
  const { login, status, error, isAuthenticated } = useAuth();

  useEffect(() => {
    if (status === 'signedIn' && isAuthenticated) {
      logger.info({
        message: 'Login successful, redirecting to home',
      });
      router.push('/(app)');
    }
  }, [status, isAuthenticated, router]);

  const onSubmit: LoginFormProps['onSubmit'] = async (data) => {
    logger.info({
      message: 'Starting Login (button press)',
      context: { username: data.username },
    });
    await login({ username: data.username, password: data.password });
  };

  return (
    <>
      <FocusAwareStatusBar />
      <LoginForm
        onSubmit={onSubmit}
        isLoading={status === 'loading'}
        error={error ?? undefined}
      />
    </>
  );
}
