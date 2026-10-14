import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppLanguage = "system" | "en" | "pl";
export type ResolvedLanguage = Exclude<AppLanguage, "system">;

/** "system" follows the OS/browser language; anything that is not Polish falls back to English. */
export const resolveLanguage = (language: AppLanguage): ResolvedLanguage => {
  if (language !== "system") return language;
  const browser = typeof navigator !== "undefined" ? navigator.language : "";
  return browser.toLowerCase().startsWith("pl") ? "pl" : "en";
};

interface LanguageStore {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      language: "system",
      setLanguage: (language) => set({ language }),
    }),
    { name: "app-language" }
  )
);
