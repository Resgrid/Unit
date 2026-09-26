import { ChevronDownIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView } from 'react-native';

import { getSystemConfig } from '@/api/config';
import { Env } from '@/lib/env';
import { logger } from '@/lib/logging';
import type { ResgridSystemLocation } from '@/models/v4/configs/getSystemConfigResultData';
import { useServerUrlStore } from '@/stores/app/server-url-store';

import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '../ui/actionsheet';
import { Button, ButtonSpinner, ButtonText } from '../ui/button';
import { Center } from '../ui/center';
import { FormControl, FormControlError, FormControlErrorText, FormControlHelperText, FormControlLabel, FormControlLabelText } from '../ui/form-control';
import { HStack } from '../ui/hstack';
import { Input, InputField } from '../ui/input';
import { Select, SelectBackdrop, SelectContent, SelectDragIndicator, SelectDragIndicatorWrapper, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '../ui/select';
import { Text } from '../ui/text';
import { VStack } from '../ui/vstack';

interface ServerUrlForm {
  url: string;
}

interface ServerUrlBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a save that actually switched servers (e.g. to log out of the old one). */
  onUrlChanged?: () => Promise<void>;
}

// Plain HTTP would send the OAuth2 password grant and bearer tokens in
// cleartext — only allow it in dev builds (local testing against localhost).
const URL_PATTERN = __DEV__ ? /^https?:\/\/.+/ : /^https:\/\/.+/;
const CUSTOM_SERVER_VALUE = '__custom__';
const API_PATH_SUFFIX = `/api/${Env.API_VERSION}`;

const normalizeInputUrl = (url: string) => url.trim().replace(/\/+$/, '');

const normalizeBaseUrl = (url: string) => {
  const trimmedUrl = normalizeInputUrl(url);

  if (trimmedUrl.endsWith(API_PATH_SUFFIX)) {
    return trimmedUrl.slice(0, -API_PATH_SUFFIX.length).replace(/\/+$/, '');
  }

  return trimmedUrl;
};

const normalizeCustomDisplayUrl = (url: string) => normalizeBaseUrl(url).replace(/^(https?:\/\/[^/]+).*$/, '$1');

const buildApiUrl = (url: string) => `${normalizeBaseUrl(url)}${API_PATH_SUFFIX}`;

export function ServerUrlBottomSheet({ isOpen, onClose, onUrlChanged }: ServerUrlBottomSheetProps) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingServerOptions, setIsLoadingServerOptions] = React.useState(true);
  const [locations, setLocations] = React.useState<ResgridSystemLocation[]>([]);
  const [selectedServer, setSelectedServer] = React.useState<string>(CUSTOM_SERVER_VALUE);
  const setUrl = useServerUrlStore((s) => s.setUrl);
  const getUrl = useServerUrlStore((s) => s.getUrl);

  const {
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm<ServerUrlForm>();

  React.useEffect(() => {
    if (!isOpen) {
      setIsLoadingServerOptions(true);
      return undefined;
    }

    let isMounted = true;

    const loadServerOptions = async () => {
      try {
        const [currentUrl, systemConfig] = await Promise.all([getUrl(), getSystemConfig()]);
        const normalizedCurrentUrl = normalizeBaseUrl(currentUrl);
        const nextLocations = systemConfig.Data?.Locations ?? [];
        const matchingLocation = nextLocations.find((location) => normalizeBaseUrl(location.ApiUrl) === normalizedCurrentUrl);

        if (isMounted) {
          setLocations(nextLocations);
          setValue('url', matchingLocation ? normalizeInputUrl(matchingLocation.ApiUrl) : normalizeCustomDisplayUrl(currentUrl));
          setSelectedServer(matchingLocation?.Name ?? CUSTOM_SERVER_VALUE);
        }
      } catch (error) {
        logger.error({
          message: 'Failed to load system config for server URLs',
          context: { error },
        });

        // The current server could not supply its location list (e.g. an older
        // self-hosted install) — fall back to editing the URL by hand.
        if (isMounted) {
          setLocations([]);
          setSelectedServer(CUSTOM_SERVER_VALUE);
        }

        // Read again on its own: the stored URL may be what failed above, and this
        // sheet is the way out of a broken server URL, so it must still open for editing.
        try {
          const currentUrl = await getUrl();
          if (isMounted) {
            setValue('url', normalizeCustomDisplayUrl(currentUrl));
          }
        } catch (fallbackError) {
          logger.error({
            message: 'Failed to read the current server URL',
            context: { error: fallbackError },
          });
        }
      } finally {
        if (isMounted) {
          setIsLoadingServerOptions(false);
        }
      }
    };

    loadServerOptions();

    return () => {
      isMounted = false;
    };
  }, [isOpen, setValue, getUrl]);

  const isCustomSelected = selectedServer === CUSTOM_SERVER_VALUE;

  const onFormSubmit = async (data: ServerUrlForm) => {
    try {
      setIsLoading(true);
      const selectedLocation = locations.find((location) => location.Name === selectedServer);
      const resolvedBaseUrl = isCustomSelected ? data.url : (selectedLocation?.ApiUrl ?? data.url);
      const nextApiUrl = buildApiUrl(resolvedBaseUrl);
      const previousApiUrl = buildApiUrl(await getUrl());

      await setUrl(nextApiUrl);

      if (nextApiUrl !== previousApiUrl && onUrlChanged) {
        await onUrlChanged();
      }

      logger.info({
        message: 'Server URL updated successfully',
        context: { url: nextApiUrl },
      });
      onClose();
    } catch (error) {
      logger.error({
        message: 'Failed to update server URL',
        context: { error },
      });

      setError('root', {
        message: error instanceof Error ? error.message : t('common.error'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleServerChange = useCallback(
    (nextServer: string) => {
      setSelectedServer(nextServer);

      if (nextServer === CUSTOM_SERVER_VALUE) {
        return;
      }

      const selectedLocation = locations.find((location) => location.Name === nextServer);

      if (selectedLocation) {
        setValue('url', normalizeInputUrl(selectedLocation.ApiUrl));
      }
    },
    [locations, setValue]
  );

  const fieldClassName = `rounded-lg border ${colorScheme === 'dark' ? 'border-neutral-700 bg-neutral-800' : 'border-neutral-200 bg-neutral-50'}`;
  const labelClassName = `text-sm font-medium ${colorScheme === 'dark' ? 'text-neutral-200' : 'text-neutral-700'}`;

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[80]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className={`rounded-t-3xl px-4 pb-6 ${colorScheme === 'dark' ? 'bg-neutral-900' : 'bg-white'}`}>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }} showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}>
          <VStack space="lg" className="mt-4 w-full">
            <FormControl>
              <FormControlLabel>
                <FormControlLabelText className={labelClassName}>{t('settings.server')}</FormControlLabelText>
              </FormControlLabel>
              {isLoadingServerOptions ? (
                <Center testID="server-options-loading" className={`min-h-16 p-4 ${fieldClassName}`}>
                  <ButtonSpinner />
                  <Text className={`mt-2 ${colorScheme === 'dark' ? 'text-neutral-300' : 'text-neutral-600'}`}>{t('loading.loadingData')}</Text>
                </Center>
              ) : (
                <Select onValueChange={handleServerChange} selectedValue={selectedServer}>
                  <SelectTrigger className={fieldClassName}>
                    <SelectInput placeholder={t('settings.server')} value={isCustomSelected ? t('settings.custom') : locations.find((location) => location.Name === selectedServer)?.Name} />
                    <SelectIcon as={ChevronDownIcon} className="mr-3" />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdrop />
                    <SelectContent className="max-h-[60vh] pb-20">
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      {locations.map((location) => (
                        <SelectItem key={location.Name} label={location.Name} value={location.Name} />
                      ))}
                      <SelectItem label={t('settings.custom')} value={CUSTOM_SERVER_VALUE} />
                    </SelectContent>
                  </SelectPortal>
                </Select>
              )}
            </FormControl>
            <FormControl isRequired={isCustomSelected} isInvalid={isCustomSelected ? !!errors.url : false}>
              <FormControlLabel>
                <FormControlLabelText className={labelClassName}>{t('settings.server_url')}</FormControlLabelText>
              </FormControlLabel>
              <Controller
                control={control}
                name="url"
                rules={{
                  validate: (value) => {
                    if (!isCustomSelected) {
                      return true;
                    }

                    if (!value) {
                      return t('form.required');
                    }

                    return URL_PATTERN.test(value) ? true : t('form.invalid_url');
                  },
                }}
                render={({ field: { onChange, value } }) => (
                  <Input className={fieldClassName}>
                    <InputField
                      value={value}
                      onChangeText={onChange}
                      placeholder={t('settings.enter_server_url')}
                      editable={isCustomSelected && !isLoadingServerOptions}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      textContentType="URL"
                      returnKeyType="done"
                      autoFocus={false}
                      blurOnSubmit={true}
                    />
                  </Input>
                )}
              />
              <FormControlHelperText>
                <FormControlError>
                  <FormControlErrorText>{errors.url?.message}</FormControlErrorText>
                </FormControlError>
              </FormControlHelperText>
            </FormControl>
            <Center>
              <Text size="md" className="text-center text-red-500">
                {t('settings.server_url_note')}
              </Text>
            </Center>

            {errors.root?.message ? (
              <Text size="sm" className="w-full text-center text-red-500">
                {errors.root.message}
              </Text>
            ) : null}

            <HStack space="md" className="mt-4">
              <Button variant="outline" className="flex-1" onPress={onClose}>
                <ButtonText>{t('common.cancel')}</ButtonText>
              </Button>
              <Button className="flex-1 bg-primary-600" onPress={handleSubmit(onFormSubmit)} disabled={isLoading || isLoadingServerOptions}>
                {isLoading ? <ButtonSpinner /> : <ButtonText>{t('common.save')}</ButtonText>}
              </Button>
            </HStack>
          </VStack>
        </ScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}
