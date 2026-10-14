import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import pl from "@/locales/pl.json";
import { resolveLanguage, useLanguageStore } from "@/hooks/use-language-store";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    pl: { translation: pl },
  },
  lng: resolveLanguage(useLanguageStore.getState().language),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

// Switching the language in settings takes effect immediately, without a reload.
useLanguageStore.subscribe((state) => {
  i18n.changeLanguage(resolveLanguage(state.language));
});

export default i18n;
