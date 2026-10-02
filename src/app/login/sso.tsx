import { zodResolver } from '@hookform/resolvers/zod';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as z from 'zod';

import { LoginMfaSheet } from '@/components/auth/login-mfa-sheet';
import { LoginOtpModal } from '@/components/auth/login-otp-modal';
import { FocusAwareStatusBar, View } from '@/components/ui';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { FormControl, FormControlError, FormControlErrorIcon, FormControlErrorText, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';
import { Input, InputField, InputSlot } from '@/components/ui/input';
import { AlertTriangle, ArrowLeft, ShieldCheck } from '@/components/ui/lucide-icons';
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/modal';
import { Text } from '@/components/ui/text';
import colors from '@/constants/colors';
import { useOidcLogin } from '@/hooks/use-oidc-login';
import { useSamlLogin } from '@/hooks/use-saml-login';
import { useAuth } from '@/lib/auth';
import { logger } from '@/lib/logging';
import { desktopLegacySso } from '@/lib/mfa/legacy-sso-desktop';
import { isSharedInstallation } from '@/lib/mfa/shared-installation';
import type { DepartmentSsoConfig } from '@/services/sso-discovery';
import { fetchSsoConfigForUser } from '@/services/sso-discovery';
import useAuthStore from '@/stores/auth/store';

const ssoFormSchema = z.object({
  username: z.string({ required_error: 'Username is required' }).min(3, 'Username must be at least 3 characters'),
  departmentId: z.string().optional(),
});

type FormType = z.infer<typeof ssoFormSchema>;

export default function SsoLogin() {
  const [ssoConfig, setSsoConfig] = useState<DepartmentSsoConfig | null>(null);
  const [isLookingUpSso, setIsLookingUpSso] = useState(false);
  const [isSsoLoading, setIsSsoLoading] = useState(false);
  const [isErrorModalVisible, setIsErrorModalVisible] = useState(false);
  const [otpDismissed, setOtpDismissed] = useState(false);
  const pendingUsernameRef = useRef<string>('');

  const { t } = useTranslation();
  const router = useRouter();
  const { ssoLogin, status } = useAuth();
  const authError = useAuthStore((s) => s.error);
  // 'mfaRequired' is also how the password login reports its own 2FA challenge. Opening this
  // screen's prompt on that status alone means retrySsoWithOtp fires with no pending SSO
  // exchange, which drops the user into an error state instead of a code prompt.
  const isSsoMfaPending = useAuthStore((s) => s.isSsoMfaPending);
  const mfaChallenge = useAuthStore((s) => s.mfaChallenge);

  const oidc = useOidcLogin({
    authority: ssoConfig?.authority ?? '',
    clientId: ssoConfig?.clientId ?? '',
  });

  const { startSamlLogin, isSamlCallback, validateSamlCallback } = useSamlLogin();

  const {
    control,
    getValues,
    formState: { errors },
  } = useForm<FormType>({ resolver: zodResolver(ssoFormSchema) });

  useEffect(() => {
    if (status === 'signedIn') {
      router.push('/(app)');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'error') {
      setIsSsoLoading(false);
      setIsErrorModalVisible(true);
    }
  }, [status]);

  // Re-arm the OTP prompt whenever a fresh SSO 2FA challenge arrives
  useEffect(() => {
    if (status === 'mfaRequired' && isSsoMfaPending) {
      setIsSsoLoading(false);
      setOtpDismissed(false);
    }
  }, [status, isSsoMfaPending]);

  const handleOtpSubmit = useCallback(async (code: string) => {
    await useAuthStore.getState().retrySsoWithOtp(code);
  }, []);

  // ── OIDC response handler ─────────────────────────────────────────────────
  useEffect(() => {
    if (oidc.response?.type !== 'success') return;

    setIsSsoLoading(true);
    oidc
      .exchangeForResgridToken()
      .then((idToken) => {
        if (!idToken) {
          setIsSsoLoading(false);
          setIsErrorModalVisible(true);
          return;
        }
        ssoLogin({
          provider: 'oidc',
          externalToken: idToken,
          username: pendingUsernameRef.current,
          // The exchange needs the department; discovery gave its encrypted token.
          ...(ssoConfig?.departmentToken ? { departmentToken: ssoConfig.departmentToken } : {}),
        });
      })
      .catch(() => {
        setIsSsoLoading(false);
        setIsErrorModalVisible(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oidc.response]);

  // ── SAML callbacks: a deep link (mobile), or the desktop main process's answer ─
  const finishSamlCallback = useCallback(
    async (url: string) => {
      // Validates the RelayState nonce — callbacks not belonging to a flow this
      // app initiated (login CSRF) are rejected here.
      const callback = await validateSamlCallback(url);
      if (!callback) {
        setIsSsoLoading(false);
        setIsErrorModalVisible(true);
        return;
      }
      setIsSsoLoading(true);
      await ssoLogin({
        provider: 'saml2',
        externalToken: callback.samlResponse,
        username: pendingUsernameRef.current,
        // The relay sends the department (encrypted) with the callback; the exchange needs it.
        ...(callback.departmentToken ? { departmentToken: callback.departmentToken } : {}),
      });
    },
    [validateSamlCallback, ssoLogin]
  );

  useEffect(() => {
    const subscription = Linking.addEventListener('url', async ({ url }: { url: string }) => {
      if (!isSamlCallback(url)) return;
      await finishSamlCallback(url);
    });

    return () => subscription?.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving this screen ends a desktop sign-in still waiting in the member's browser.
  useEffect(
    () => () => {
      void desktopLegacySso()?.legacySsoCancel();
    },
    []
  );

  // ── SSO lookup (called from username or departmentId blur) ───────────────
  const triggerSsoLookup = useCallback(async (username: string, departmentIdStr?: string) => {
    if (username.trim().length < 3) return;
    pendingUsernameRef.current = username.trim();
    setIsLookingUpSso(true);
    setSsoConfig(null);

    const deptId = departmentIdStr ? parseInt(departmentIdStr, 10) : undefined;
    const resolvedDeptId = deptId && !isNaN(deptId) && deptId > 0 ? deptId : undefined;

    const { config } = await fetchSsoConfigForUser(username.trim(), resolvedDeptId);
    setIsLookingUpSso(false);

    if (config) {
      logger.info({
        message: 'SSO config fetched',
        context: { ssoEnabled: config.ssoEnabled, providerType: config.providerType, departmentId: resolvedDeptId },
      });
      setSsoConfig(config);
    }
  }, []);

  const handleUsernameBlur = useCallback((username: string) => triggerSsoLookup(username, getValues('departmentId')), [triggerSsoLookup, getValues]);

  const handleDepartmentIdBlur = useCallback((departmentIdStr: string) => triggerSsoLookup(getValues('username'), departmentIdStr), [triggerSsoLookup, getValues]);

  // ── SSO button press ──────────────────────────────────────────────────────
  const handleSsoPress = useCallback(async () => {
    if (!ssoConfig) return;
    setIsSsoLoading(true);

    if (ssoConfig.brokeredSsoAvailable) {
      // Brokered SSO (passkey plan section 7.7.2): the Resgrid broker talks to the provider, and only a one-time code
      // comes back to this app. The app-side OIDC and SAML flows below remain for servers without the broker.
      // A refusal sets the store's error status, which opens the error modal above.
      await useAuthStore.getState().loginWithBrokeredSso(ssoConfig.departmentToken ? { departmentToken: ssoConfig.departmentToken } : { username: pendingUsernameRef.current });
      setIsSsoLoading(false);
      return;
    }

    // The provider and the SAML relay return to this app's own scheme: the native app receives it, and in the desktop app
    // the main process does (it also redeems the OIDC code there). A web page receives neither.
    const desktop = desktopLegacySso();
    if (ssoConfig.providerType === 'oidc') {
      if (desktop) {
        // A shared installation needs a fresh provider sign-in (see the OIDC hook).
        const signedIn = await desktop.legacySsoOidc(ssoConfig.authority ?? '', ssoConfig.clientId ?? '', isSharedInstallation());
        if (!signedIn.ok) {
          setIsSsoLoading(false);
          if (signedIn.reason !== 'cancelled') {
            setIsErrorModalVisible(true);
          }
          return;
        }
        // loading cleared by the status effects above
        await ssoLogin({
          provider: 'oidc',
          externalToken: signedIn.idToken,
          username: pendingUsernameRef.current,
          ...(ssoConfig.departmentToken ? { departmentToken: ssoConfig.departmentToken } : {}),
        });
        return;
      }
      await oidc.promptAsync();
      // loading cleared by OIDC response useEffect
    } else if (ssoConfig.providerType === 'saml2') {
      // Without the broker, SAML starts on the server's page (an app cannot build the AuthnRequest). On a web page, or when
      // the server names no start page, the member is told it cannot start.
      if ((Platform.OS !== 'web' || desktop) && ssoConfig.samlLoginUrl) {
        const returned = await startSamlLogin(ssoConfig.samlLoginUrl);
        if (returned) {
          await finishSamlCallback(returned);
          return;
        }
      } else {
        setIsErrorModalVisible(true);
      }
      setIsSsoLoading(false);
    } else {
      setIsSsoLoading(false);
    }
  }, [ssoConfig, oidc, startSamlLogin, ssoLogin, finishSamlCallback]);

  const showSsoButton = ssoConfig?.ssoEnabled === true;

  return (
    <>
      <FocusAwareStatusBar />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={10}>
        <View className="flex-1 p-4">
          {/* Back button */}
          <View className="mb-4 mt-2">
            <Button variant="link" action="secondary" onPress={() => router.back()} className="self-start">
              <ArrowLeft size={18} className="mr-1" />
              <ButtonText className="text-sm">{t('common.back')}</ButtonText>
            </Button>
          </View>

          <View className="mb-8 items-center">
            <ShieldCheck size={56} color={colors.light.primary[500]} />
            <Text className="mt-4 text-center text-3xl font-bold">{t('login.sso_title')}</Text>
            <Text className="mt-2 max-w-xl text-center text-gray-500">{t('login.sso_subtitle')}</Text>
          </View>

          {/* Username */}
          <FormControl isInvalid={!!errors?.username} className="mb-4 w-full">
            <FormControlLabel>
              <FormControlLabelText>{t('login.username')}</FormControlLabelText>
            </FormControlLabel>
            <Controller
              defaultValue=""
              name="username"
              control={control}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input>
                  <InputField
                    placeholder={t('login.username_placeholder')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={() => {
                      onBlur();
                      handleUsernameBlur(value);
                    }}
                    returnKeyType="done"
                    autoCapitalize="none"
                    autoComplete="off"
                  />
                  {isLookingUpSso ? (
                    <InputSlot className="pr-3">
                      <ActivityIndicator size="small" />
                    </InputSlot>
                  ) : null}
                </Input>
              )}
            />
            <FormControlError>
              <FormControlErrorIcon as={AlertTriangle} className="text-red-500" />
              <FormControlErrorText className="text-red-500">{errors?.username?.message}</FormControlErrorText>
            </FormControlError>
          </FormControl>

          {/* Department ID (optional) */}
          <FormControl isInvalid={!!errors?.departmentId} className="w-full">
            <FormControlLabel>
              <FormControlLabelText>{t('login.sso_department_id')}</FormControlLabelText>
            </FormControlLabel>
            <Controller
              defaultValue=""
              name="departmentId"
              control={control}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input>
                  <InputField
                    placeholder={t('login.sso_department_id_placeholder')}
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={() => {
                      onBlur();
                      handleDepartmentIdBlur(value ?? '');
                    }}
                    returnKeyType="done"
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    autoComplete="off"
                  />
                </Input>
              )}
            />
            <FormControlError>
              <FormControlErrorIcon as={AlertTriangle} className="text-red-500" />
              <FormControlErrorText className="text-red-500">{errors?.departmentId?.message}</FormControlErrorText>
            </FormControlError>
          </FormControl>

          {/* SSO button — appears after lookup resolves */}
          {showSsoButton ? (
            <View className="mt-6 w-full">
              {isSsoLoading ? (
                <Button className="w-full" disabled>
                  <ButtonSpinner color={colors.light.neutral[400]} />
                  <ButtonText className="ml-2">{t('login.sso_signing_in')}</ButtonText>
                </Button>
              ) : (
                <Button className="w-full" variant="solid" action="primary" onPress={handleSsoPress} accessibilityLabel={t('login.sso_button')}>
                  <ShieldCheck size={18} color="#fff" style={{ marginRight: 8 }} />
                  <ButtonText>{t('login.sso_button')}</ButtonText>
                </Button>
              )}
              {ssoConfig?.departmentName ? <Text className="mt-2 text-center text-xs text-gray-400">{t('login.sso_department', { name: ssoConfig.departmentName })}</Text> : null}
            </View>
          ) : null}

          {/* Hint shown while waiting for lookup */}
          {!isLookingUpSso && !showSsoButton && pendingUsernameRef.current ? <Text className="mt-4 text-center text-sm text-gray-400">{t('login.sso_not_found')}</Text> : null}
        </View>
      </KeyboardAvoidingView>

      {/* Error modal */}
      <Modal isOpen={isErrorModalVisible} onClose={() => setIsErrorModalVisible(false)} size="full" {...({} as any)}>
        <ModalBackdrop />
        <ModalContent className="m-4 w-full max-w-3xl rounded-2xl">
          <ModalHeader>
            <Text className="text-xl font-semibold">{t('login.sso_error_title')}</Text>
          </ModalHeader>
          <ModalBody>
            <Text>{t('login.sso_error_message')}</Text>
          </ModalBody>
          <ModalFooter>
            <Button variant="solid" size="sm" action="primary" onPress={() => setIsErrorModalVisible(false)}>
              <ButtonText>{t('login.errorModal.confirmButton')}</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Second factor after a brokered sign-in, on the login transaction the broker's redemption started */}
      <LoginMfaSheet isOpen={status === 'mfaRequired' && mfaChallenge?.source === 'sso' && mfaChallenge.kind !== 'legacy'} onLostFactor={() => router.push('/login/recovery')} />

      {/* Two-factor challenge: SSO exchange answered mfa_required / invalid_totp */}
      <LoginOtpModal
        isOpen={status === 'mfaRequired' && isSsoMfaPending && !otpDismissed}
        isSubmitting={status === 'loading'}
        invalidCode={authError === 'invalid_totp'}
        onSubmit={handleOtpSubmit}
        onClose={() => setOtpDismissed(true)}
      />
    </>
  );
}
