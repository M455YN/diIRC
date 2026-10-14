import { pl } from "date-fns/locale";
import { resolveLanguage, useLanguageStore } from "@/hooks/use-language-store";

/** date-fns locale matching the app language; undefined keeps the English default. */
export const dateLocale = () =>
  resolveLanguage(useLanguageStore.getState().language) === "pl" ? { locale: pl } : undefined;
