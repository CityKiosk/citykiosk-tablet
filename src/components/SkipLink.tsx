"use client";

import { useI18n } from "./I18nProvider";

export default function SkipLink() {
  const { t } = useI18n();
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:px-4 focus:py-2 focus:bg-sky-700 focus:text-white focus:rounded-lg focus:shadow-lg"
    >
      {t.nav.skip}
    </a>
  );
}
