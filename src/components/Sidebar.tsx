"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { useI18n } from "./I18nProvider";
import ThemeToggle from "./ThemeToggle";
import {
  BoxesIcon,
  GalleryHorizontalIcon,
  LogOutIcon,
  PackageIcon,
  ReceiptIcon,
  SettingsIcon,
  XIcon,
} from "./icons";
import { signOut } from "@/app/(auth)/logout/actions";
import { ComponentType, SVGProps } from "react";

type Item = {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  badge?: number;
  badgeLabel?: string;
};

export default function Sidebar({
  onNavigate,
  collapsed = false,
  onToggleCollapse,
  lowStockCount = 0,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  lowStockCount?: number;
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  // Panel ve Müşteriler şimdilik gizli — rotalar kodda duruyor, geri eklemek için
  // sadece bu listeye satır eklemek yeterli.
  const items: Item[] = [
    { href: "/catalog", label: t.nav.catalog, Icon: PackageIcon },
    { href: "/browse", label: t.nav.browse, Icon: GalleryHorizontalIcon },
    { href: "/orders", label: t.nav.orders, Icon: ReceiptIcon },
    {
      href: "/stock",
      label: t.nav.stock,
      Icon: BoxesIcon,
      badge: lowStockCount,
      badgeLabel: lowStockCount > 0 ? t.nav.stockBadge(lowStockCount) : undefined,
    },
    { href: "/settings", label: t.nav.settings, Icon: SettingsIcon },
  ];

  return (
    <aside
      className={`h-full flex flex-col bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className={`px-3 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center ${collapsed ? "justify-center" : "justify-between gap-2 px-5"}`}>
        <Link
          href="/"
          onClick={onNavigate}
          aria-label={t.nav.home}
          className="flex items-center gap-2.5 group cursor-pointer focus-visible:outline-none rounded-lg min-w-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-192.png" alt="" width={36} height={36} className="flex-shrink-0 w-9 h-9 rounded-lg shadow-sm" />
          {!collapsed && (
            <span className="flex flex-col leading-tight min-w-0">
              <span className="font-semibold text-slate-900 dark:text-slate-50 text-[15px] tracking-tight truncate">
                {t.appName}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider truncate">
                {t.nav.tagline}
              </span>
            </span>
          )}
        </Link>
        {!collapsed && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={t.common.close}
            className="cursor-pointer hidden lg:inline-flex w-8 h-8 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
          >
            <XIcon width={16} height={16} />
          </button>
        )}
      </div>

      <nav aria-label={t.nav.main} className={`flex-1 overflow-y-auto py-4 space-y-1 ${collapsed ? "px-2" : "px-3"}`}>
        {items.map(({ href, label, Icon, badge, badgeLabel }) => {
          const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
          const hasBadge = typeof badge === "number" && badge > 0;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 rounded-lg text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 relative ${
                collapsed ? "justify-center w-12 h-12 mx-auto" : "px-3 py-2.5"
              } ${
                active
                  ? "bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <span className="relative">
                <Icon
                  width={18}
                  height={18}
                  className={active ? "text-sky-600 dark:text-sky-400" : ""}
                />
                {hasBadge && collapsed && (
                  <span
                    aria-label={badgeLabel}
                    className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-950"
                  />
                )}
              </span>
              {!collapsed && <span className="flex-1">{label}</span>}
              {!collapsed && hasBadge && (
                <span
                  aria-label={badgeLabel}
                  className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-semibold tabular"
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="px-3 py-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <ThemeToggle />
          </div>
          <LogoutButton collapsed={false} />
        </div>
      )}
      {collapsed && (
        <div className="px-2 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-col items-center gap-2">
          <ThemeToggle />
          <LogoutButton collapsed={true} />
        </div>
      )}
    </aside>
  );
}

function LogoutButton({ collapsed }: { collapsed: boolean }) {
  const { locale } = useI18n();
  const [isPending, startTransition] = useTransition();
  const label = locale === "de" ? "Abmelden" : "Çıkış";

  return (
    <button
      type="button"
      disabled={isPending}
      title={collapsed ? label : undefined}
      onClick={() => startTransition(() => signOut())}
      className={`cursor-pointer flex items-center gap-3 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-60 ${
        collapsed ? "justify-center w-12 h-12 mx-auto" : "w-full px-3 py-2.5"
      }`}
    >
      <LogOutIcon width={18} height={18} />
      {!collapsed && <span>{label}</span>}
    </button>
  );
}
