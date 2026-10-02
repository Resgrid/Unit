import { type Href, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { LoginFormProps } from '@/app/login/login-form';
import { LoginMfaSheet } from '@/components/auth/login-mfa-sheet';
import { LoginOtpModal } from '@/components/auth/login-otp-modal';
import { ServerUrlBottomSheet } from '@/components/settings/server-url-bottom-sheet';
import { FocusAwareStatusBar } from '@/components/ui';
import { Button, ButtonText } from '@/components/ui/button';
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/modal';
import { Text } from '@/components/ui/text';
import { useAnalytics } from '@/hooks/use-analytics';
import { useAuth } from '@/lib/auth';
import { logger } from '@/lib/logging';
import { isMfaErrorCode, mfaErrorKey } from '@/lib/mfa/messages';
import { useSharedInstallation } from '@/lib/mfa/shared-installation';
import useAuthStore from '@/stores/auth/store';

import { LoginForm } from './login-form';

export default function Login() {
  const [isErrorModalVisible, setIsErrorModalVisible] = useState(false);
  const [showServerUrl, setShowServerUrl] = useState(false);
  // Held only to resubmit with the TOTP code after an mfa_required challenge; memory-only,
  // cleared on success/unmount with the rest of the component state. Never logged.
  const [pendingCredentials, setPendingCredentials] = useState<{ username: string; password: string } | null>(null);
  const [otpDismissed, setOtpDismissed] = useState(false);

  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const router = useRouter();
  const { login, status, error, isAuthenticated } = useAuth();
  const mfaChallenge = useAuthStore((s) => s.mfaChallenge);
  const installation = useSharedInstallation();
  // A sign-in that ended (expired, too many attempts, policy changed) or a shared shift that ran out says why in the
  // member's language.
  const displayError = error === 'shift_ended' ? t('shared_session.shift_ended') : isMfaErrorCode(error) ? t(mfaErrorKey(error)) : error;

  // Track when login view is rendered
  useEffect(() => {
    trackEvent('login_view_rendered', {
      hasError: !!error,
      status: status,
    });
  }, [trackEvent, error, status]);

  useEffect(() => {
    if (status === 'signedIn' && isAuthenticated) {
      logger.info({ message: 'Login successful, redirecting to home' });
      router.push('/(app)');
    }
  }, [status, isAuthenticated, router]);

  useEffect(() => {
    if (status === 'error') {
      logger.error({ message: 'Login failed', context: { error } });
      setIsErrorModalVisible(true);
    }
  }, [status, error]);

  // ── Local login ───────────────────────────────────────────────────────────
  const onSubmit: LoginFormProps['onSubmit'] = async (data) => {
    logger.info({ message: 'Starting Login (button press)' });
    setPendingCredentials({ username: data.username, password: data.password });
    setOtpDismissed(false);
    await login({ username: data.username, password: data.password });
  };

  const onOtpSubmit = async (code: string) => {
    if (!pendingCredentials) {
      return;
    }
    await login({ ...pendingCredentials, otpCode: code });
  };

  return (
    <>
      <FocusAwareStatusBar />
      <LoginForm
        onSubmit={onSubmit}
        isLoading={status === 'loading'}
        error={displayError ?? undefined}
        onServerUrlPress={() => setShowServerUrl(true)}
        onSsoPress={() => router.push('/login/sso')}
        onSharedDevicePress={() => router.push('/login/shared-device' as unknown as Href)}
        sharedDevice={installation}
      />

      <Modal
        isOpen={isErrorModalVisible}
        onClose={() => {
          setIsErrorModalVisible(false);
        }}
        size="full"
        {...({} as any)}
      >
        <ModalBackdrop />
        <ModalContent className="m-4 w-full max-w-3xl rounded-2xl">
          <ModalHeader>
            <Text className="text-xl font-semibold">{t('login.errorModal.title')}</Text>
          </ModalHeader>
          <ModalBody>
            <Text>{t('login.errorModal.message')}</Text>
            {displayError ? <Text className="mt-2 text-sm text-gray-500">{displayError}</Text> : null}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="solid"
              size="sm"
              action="primary"
              onPress={() => {
                setIsErrorModalVisible(false);
              }}
            >
              <ButtonText>{t('login.errorModal.confirmButton')}</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ServerUrlBottomSheet isOpen={showServerUrl} onClose={() => setShowServerUrl(false)} />

      {/* Second factor on the login transaction: the methods this sign-in accepts, or the setup the department requires. An SSO sign-in's second factor is the SSO screen's, on top of this one */}
      <LoginMfaSheet isOpen={status === 'mfaRequired' && mfaChallenge != null && mfaChallenge.kind !== 'legacy' && mfaChallenge.source !== 'sso'} onLostFactor={() => router.push('/login/recovery')} />

      {/* Two-factor challenge on an older server: token endpoint answered mfa_required / invalid_totp with no transaction */}
      <LoginOtpModal
        isOpen={status === 'mfaRequired' && mfaChallenge?.kind === 'legacy' && !otpDismissed && pendingCredentials != null}
        isSubmitting={status === 'loading'}
        invalidCode={error === 'invalid_totp'}
        onSubmit={onOtpSubmit}
        onClose={() => setOtpDismissed(true)}
      />
    </>
  );
}
