"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { dict, Dict } from "@/lib/i18n";
import { Locale } from "@/lib/types";

const STORAGE_KEY = "souvenir_locale";

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Dict;
};

const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale: Locale = "de";

  useEffect(() => {
    document.documentElement.lang = "de";
  }, []);

  const setLocale = useCallback((_l: Locale) => {
    // Turkish support removed — locale is always "de"
  }, []);

  return (
    <I18nCtx.Provider value={{ locale, setLocale, t: dict[locale] }}>
      {children}
    </I18nCtx.Provider>
  );
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
