import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import i18n, { type AppLanguage } from './i18n';

const STORAGE_KEY = 'app_language';

interface LanguageState {
  language: AppLanguage;
  /** False until the saved preference (if any) has been loaded and applied — avoids a flash of the wrong language on cold start. */
  isReady: boolean;
  setLanguage: (language: AppLanguage) => void;
  loadSaved: () => Promise<void>;
}

/**
 * Manual, staff-controlled, per-device — no account-level setting, no
 * phone-locale detection. Defaults to English until the staff member
 * picks otherwise (see ShiftStatusBar's dropdown), then remembers it
 * via AsyncStorage on this device from then on.
 */
export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'en',
  isReady: false,

  setLanguage: (language) => {
    void i18n.changeLanguage(language);
    set({ language });
    AsyncStorage.setItem(STORAGE_KEY, language).catch(() => {
      // Best-effort persistence — a failed write just means the choice
      // doesn't survive to the next app launch, not a user-facing error.
    });
  },

  loadSaved: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'fr') {
        await i18n.changeLanguage(saved);
        set({ language: saved });
      }
    } catch {
      // No saved preference, or storage unavailable — stays on the English default.
    } finally {
      set({ isReady: true });
    }
  },
}));
