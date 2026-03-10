import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, EyeIcon, EyeOffIcon, LogIn, ShieldCheck } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Image, Keyboard } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as z from 'zod';

import { View } from '@/components/ui';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { FormControl, FormControlError, FormControlErrorIcon, FormControlErrorText, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import colors from '@/constants/colors';

// Function to create schema - makes it easier to mock for testing
const createLoginFormSchema = () =>
  z.object({
    username: z
      .string({
        required_error: 'Username is required',
      })
      .min(3, 'Username must be at least 3 characters'),
    password: z
      .string({
        required_error: 'Password is required',
      })
      .min(1, 'Password is required'),
  });

const loginFormSchema = createLoginFormSchema();

export type FormType = z.infer<typeof loginFormSchema>;

export type LoginFormProps = {
  onSubmit?: SubmitHandler<FormType>;
  isLoading?: boolean;
  error?: string;
  onServerUrlPress?: () => void;
  /** Called when the user taps "Sign In with SSO" to navigate to the SSO login page */
  onSsoPress?: () => void;
};

export const LoginForm = ({ onSubmit = () => { }, isLoading = false, error = undefined, onServerUrlPress, onSsoPress }: LoginFormProps) => {
  const { colorScheme } = useColorScheme();
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormType>({
    resolver: zodResolver(loginFormSchema),
  });
  const [validated] = useState({
    usernameValid: true,
    passwordValid: true,
  });

  const [showPassword, setShowPassword] = useState(false);

  const handleState = () => {
    setShowPassword((showState) => !showState);
  };
  const handleKeyPress = () => {
    Keyboard.dismiss();
    handleSubmit(onSubmit)();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={10}>
      <View className="flex-1 justify-center p-4">
        <View className="items-center justify-center">
          <Image style={{ width: '96%' }} source={colorScheme === 'dark' ? require('@assets/images/Resgrid_JustText_White.png') : require('@assets/images/Resgrid_JustText.png')} resizeMode="contain" />
          <Text className="pb-6 text-center text-4xl font-bold">{t('login.title')}</Text>
          <Text className="mb-6 max-w-xl text-center text-gray-500">{t('login.subtitle')}</Text>
        </View>

        {/* Username */}
        <FormControl isInvalid={!!errors?.username || !validated.usernameValid} className="w-full">
          <FormControlLabel>
            <FormControlLabelText>{t('login.username')}</FormControlLabelText>
          </FormControlLabel>
          <Controller
            defaultValue=""
            name="username"
            control={control}
            rules={{
              validate: async (value) => {
                try {
                  await loginFormSchema.parseAsync({ username: value, password: 'placeholder' });
                  return true;
                } catch (err: any) {
                  return err.message;
                }
              },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Input>
                <InputField
                  placeholder={t('login.username_placeholder')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  onSubmitEditing={handleKeyPress}
                  returnKeyType="next"
                  autoCapitalize="none"
                  autoComplete="off"
                />
              </Input>
            )}
          />
          <FormControlError>
            <FormControlErrorIcon as={AlertTriangle} className="text-red-500" />
            <FormControlErrorText className="text-red-500">{errors?.username?.message}</FormControlErrorText>
          </FormControlError>
        </FormControl>

        {/* Password form */}
        <FormControl isInvalid={!!errors.password || !validated.passwordValid} className="w-full">
          <FormControlLabel>
            <FormControlLabelText>{t('login.password')}</FormControlLabelText>
          </FormControlLabel>
          <Controller
            defaultValue=""
            name="password"
            control={control}
            rules={{
              validate: async (value) => {
                try {
                  await loginFormSchema.parseAsync({ username: getValues('username'), password: value });
                  return true;
                } catch (err: any) {
                  return err.message;
                }
              },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Input>
                <InputField
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('login.password_placeholder')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  onSubmitEditing={handleKeyPress}
                  returnKeyType="done"
                  autoCapitalize="none"
                  autoComplete="off"
                />
                <InputSlot onPress={handleState} className="pr-3">
                  <InputIcon as={showPassword ? EyeIcon : EyeOffIcon} />
                </InputSlot>
              </Input>
            )}
          />
          <FormControlError>
            <FormControlErrorIcon as={AlertTriangle} className="text-red-500" />
            <FormControlErrorText className="text-red-500">{errors?.password?.message || (!validated.passwordValid && t('login.password_incorrect'))}</FormControlErrorText>
          </FormControlError>
        </FormControl>

        {isLoading ? (
          <Button className="mt-8 w-full">
            <ButtonSpinner color={colors.light.neutral[400]} />
            <ButtonText className="ml-2 text-sm font-medium">{t('login.login_button_loading')}</ButtonText>
          </Button>
        ) : (
          <Button className="mt-8 w-full" variant="solid" action="primary" onPress={handleSubmit(onSubmit)} accessibilityLabel={t('login.login_button')}>
            <ButtonText>{t('login.login_button')}</ButtonText>
          </Button>
        )}

        {error ? <Text className="mt-4 text-center text-sm text-red-500">{error}</Text> : null}

        {/* Server URL + Sign In with SSO — side by side small buttons */}
        <View className="mt-6 flex-row gap-x-2">
          {onServerUrlPress ? (
            <Button className="flex-1" variant="outline" action="secondary" size="sm" onPress={onServerUrlPress}>
              <ButtonText className="text-xs">{t('settings.server_url')}</ButtonText>
            </Button>
          ) : null}
          {onSsoPress ? (
            <Button className="flex-1" variant="outline" action="secondary" size="sm" onPress={onSsoPress}>
              <ShieldCheck size={14} style={{ marginRight: 4 }} />
              <ButtonText className="text-xs">{t('login.sso_button')}</ButtonText>
            </Button>
          ) : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default LoginForm;
