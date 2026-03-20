import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';

import { resources } from './resources';
import { getLanguage } from './utils';
export * from './utils';

const supportedLanguages = Object.keys(resources);

const getInitialLanguage = (): string => {
  // Honour the user's stored preference first
  const stored = getLanguage();
  if (stored && supportedLanguages.includes(stored)) return stored;

  // Fall back to the device/browser locale, picking the first supported match
  const locales = Localization.getLocales();
  for (const locale of locales) {
    const code = locale.languageCode;
    if (code && supportedLanguages.includes(code)) return code;
  }

  return 'en';
};

i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  compatibilityJSON: 'v3', // By default React Native projects does not support Intl

  // allows integrating dynamic values into translations.
  interpolation: {
    escapeValue: false, // escape passed in values to avoid XSS injections
  },
});

// Is it a RTL language?
export const isRTL: boolean = i18n.dir() === 'rtl';

I18nManager.allowRTL(isRTL);
I18nManager.forceRTL(isRTL);

export default i18n;
