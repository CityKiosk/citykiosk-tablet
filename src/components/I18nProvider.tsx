"use client";

import { createContext, ReactNode, useContext, useEffect } from "react";
import { dict, Dict } from "@/lib/i18n";
import { Locale } from "@/lib/types";

type Ctx = {
  locale: Locale;
  /** No-op shim — TR support removed, locale is always "de". Kept on the
   *  context shape so existing callers (LangSwitcher legacy refs, etc.) do
   *  not break. */
  setLocale: (l: Locale) => void;
  t: Dict;
};

const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = "de";
  }, []);

  return (
    <I18nCtx.Provider value={{ locale: "de", setLocale: () => {}, t: dict.de }}>
      {children}
    </I18nCtx.Provider>
  );
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
