import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager, Platform } from 'react-native';

import en from '../locales/en.json';
import he from '../locales/he.json';

const LANG_KEY = 'comot-lang';

export type AppLanguage = 'he' | 'en';

function deviceLanguage(): AppLanguage {
  const code = getLocales()[0]?.languageCode;
  return code === 'en' ? 'en' : 'he'; // Hebrew-first product
}

export function isRTL(lang: AppLanguage) {
  return lang === 'he';
}

function applyDirection(lang: AppLanguage) {
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = isRTL(lang) ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    }
  } else {
    I18nManager.allowRTL(true);
    // Takes effect after an app restart when the direction actually changes.
    I18nManager.forceRTL(isRTL(lang));
  }
}

export async function initI18n(): Promise<void> {
  const stored = (await AsyncStorage.getItem(LANG_KEY)) as AppLanguage | null;
  const lang = stored ?? deviceLanguage();

  await i18n.use(initReactI18next).init({
    resources: { he: { translation: he }, en: { translation: en } },
    lng: lang,
    fallbackLng: 'he',
    interpolation: { escapeValue: false },
  });

  applyDirection(lang);
}

export async function setLanguage(lang: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(LANG_KEY, lang);
  await i18n.changeLanguage(lang);
  applyDirection(lang);
}

export default i18n;
