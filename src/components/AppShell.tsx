"use client";

import { ReactNode, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import OfflineBanner from "./OfflineBanner";
import { MenuIcon, XIcon } from "./icons";
import Link from "next/link";
import { useI18n } from "./I18nProvider";
import { lockBodyScroll } from "@/lib/scrollLock";

const COLLAPSE_KEY = "souvenir_sidebar_collapsed";

export default function AppShell({
  children,
  lowStockCount = 0,
}: {
  children: ReactNode;
  lowStockCount?: number;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { t } = useI18n();

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const releaseLock = lockBodyScroll();
    return () => releaseLock();
  }, [mobileOpen]);

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* Desktop sidebar — fully hidden when collapsed */}
      {!collapsed && (
        <div className="hidden lg:block flex-shrink-0 sticky top-0 h-screen">
          <Sidebar onToggleCollapse={toggleCollapsed} lowStockCount={lowStockCount} />
        </div>
      )}

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div
            className="relative h-full animate-in slide-in-from-left duration-200 bg-white dark:bg-slate-950"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <Sidebar onNavigate={() => setMobileOpen(false)} lowStockCount={lowStockCount} />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label={t.common.close}
              className="absolute top-4 -right-12 w-10 h-10 inline-flex items-center justify-center rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
            >
              <XIcon />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar — mobile menu OR desktop expand button when collapsed */}
        <header className="lg:sticky lg:top-0 sticky top-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 lg:bg-transparent lg:dark:bg-transparent lg:backdrop-blur-0 lg:border-b-0">
          <div className="flex items-center justify-between px-4 lg:px-6 h-14 lg:h-12" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <button
              type="button"
              onClick={() => {
                // matchMedia, CSS lg: breakpoint'iyle aynı semantiği kullanır
                // (innerWidth scrollbar/zoom durumlarında sapabiliyor).
                if (window.matchMedia("(min-width: 1024px)").matches) toggleCollapsed();
                else setMobileOpen(true);
              }}
              aria-label={t.nav.main}
              className="cursor-pointer w-10 h-10 inline-flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
            >
              <MenuIcon />
            </button>
            <Link
              href="/"
              className="lg:hidden flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 rounded-lg px-1"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-192.png" alt="" width={28} height={28} className="w-7 h-7 rounded-md" />
              <span className="font-semibold text-slate-900 dark:text-slate-50 text-sm">
                {t.appName}
              </span>
            </Link>
            <div className="w-10 lg:hidden" />
          </div>
        </header>

        <OfflineBanner />

        <main id="main-content" className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-4 pb-32">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
