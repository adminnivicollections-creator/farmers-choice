import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import te from './te.json';
import hi from './hi.json';
import en from './en.json';

export const LANGS = ['te', 'hi', 'en'] as const;
export type Lang = (typeof LANGS)[number];
const KEY = 'fc.lang';

/** Device language if we support it, else Telugu -- this is a Telangana product. */
function deviceDefault(): Lang {
  const code = getLocales()[0]?.languageCode as Lang | undefined;
  return code && (LANGS as readonly string[]).includes(code) ? code : 'te';
}

export async function initI18n() {
  let saved: string | null = null;
  try { saved = await AsyncStorage.getItem(KEY); } catch {}
  await i18n.use(initReactI18next).init({
    resources: { te: { translation: te }, hi: { translation: hi }, en: { translation: en } },
    lng: (saved as Lang) ?? deviceDefault(),
    fallbackLng: 'en',
    // Hermes ships a trimmed Intl without PluralRules, so i18next's v4 plural
    // handling errors out on device. v3 JSON suffixes work everywhere.
    compatibilityJSON: 'v3',
    interpolation: { escapeValue: false },
  });
  return i18n;
}

export async function setLang(lang: Lang) {
  await i18n.changeLanguage(lang);
  try { await AsyncStorage.setItem(KEY, lang); } catch {}
}

export default i18n;
