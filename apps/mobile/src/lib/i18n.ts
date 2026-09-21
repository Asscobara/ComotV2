import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager, Platform } from 'react-native';

import en from '../locales/en.json';
import he from '../locales/he.json';

const LANG_KEY = 'comot-lang';

export type AppLanguage = 'he' | 'en';

/**
 * Hebrew regardless of the device locale. The product is Hebrew-first, and
 * deriving the language from the device meant an English phone opened a Hebrew
 * building's app in English. Anyone who wants English picks it in More, and that
 * choice is stored and takes precedence from then on.
 */
const DEFAULT_LANGUAGE: AppLanguage = 'he';

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
  const lang = stored === 'he' || stored === 'en' ? stored : DEFAULT_LANGUAGE;

  await i18n.use(initReactI18next).init({
    resources: { he: { translation: he }, en: { translation: en } },
    lng: lang,
    fallbackLng: DEFAULT_LANGUAGE,
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
