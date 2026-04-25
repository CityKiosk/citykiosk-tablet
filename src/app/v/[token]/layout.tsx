import type { Metadata } from "next";
import { I18nProvider } from "@/components/I18nProvider";

export const metadata: Metadata = {
  title: "Souvenirs Berlin — Produktkatalog",
  description: "Souvenirs Berlin — Produktkatalog durchblättern",
  robots: { index: false, follow: false },
};

export default function PublicCatalogLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      {children}
    </I18nProvider>
  );
}
