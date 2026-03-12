import { zodResolver } from '@hookform/resolvers/zod';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { AlertTriangle, ArrowLeft, ShieldCheck } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as z from 'zod';

import { FocusAwareStatusBar, View } from '@/components/ui';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { FormControl, FormControlError, FormControlErrorIcon, FormControlErrorText, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';
import { Input, InputField, InputSlot } from '@/components/ui/input';
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/modal';
import { Text } from '@/components/ui/text';
import colors from '@/constants/colors';
import { useOidcLogin } from '@/hooks/use-oidc-login';
import { useSamlLogin } from '@/hooks/use-saml-login';
import { useAuth } from '@/lib/auth';
import { logger } from '@/lib/logging';
import type { DepartmentSsoConfig } from '@/services/sso-discovery';
import { fetchSsoConfigForUser } from '@/services/sso-discovery';

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
  const pendingUsernameRef = useRef<string>('');

  const { t } = useTranslation();
  const router = useRouter();
  const { ssoLogin, status } = useAuth();

  const oidc = useOidcLogin({
    authority: ssoConfig?.authority ?? '',
    clientId: ssoConfig?.clientId ?? '',
  });

  const { startSamlLogin, isSamlCallback } = useSamlLogin();

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
        });
      })
      .catch(() => {
        setIsSsoLoading(false);
        setIsErrorModalVisible(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oidc.response]);

  // ── Deep-link handler for SAML callbacks ─────────────────────────────────
  useEffect(() => {
    const subscription = Linking.addEventListener('url', async ({ url }: { url: string }) => {
      if (!isSamlCallback(url)) return;
      const parsed = Linking.parse(url);
      const samlResponse = parsed.queryParams?.saml_response as string | undefined;
      if (!samlResponse) {
        setIsSsoLoading(false);
        setIsErrorModalVisible(true);
        return;
      }
      setIsSsoLoading(true);
      await ssoLogin({
        provider: 'saml2',
        externalToken: samlResponse,
        username: pendingUsernameRef.current,
      });
    });

    return () => subscription?.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    if (ssoConfig.providerType === 'oidc') {
      await oidc.promptAsync();
      // loading cleared by OIDC response useEffect
    } else if (ssoConfig.providerType === 'saml2' && ssoConfig.idpSsoUrl) {
      await startSamlLogin(ssoConfig.idpSsoUrl);
      setIsSsoLoading(false);
    } else {
      setIsSsoLoading(false);
    }
  }, [ssoConfig, oidc, startSamlLogin]);

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
    </>
  );
}
