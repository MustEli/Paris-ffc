import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { en } from './translations/en';
import { fr } from './translations/fr';

export type AppLanguage = 'en' | 'fr';
export const APP_LANGUAGES: AppLanguage[] = ['en', 'fr'];

/**
 * Staff mobile app only for now (see translations/en.ts's doc comment)
 * — built as a normal, separate i18next instance rather than anything
 * Staff-specific internally, so Admin/Management mobile and the web
 * dashboard can each get their own resource bundles added later
 * without restructuring this.
 */
void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
  },
  lng: 'en', // real default resolved from storage at startup — see languageStore.ts
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes — double-escaping would mangle apostrophes etc.
  returnNull: false,
});

export default i18n;
