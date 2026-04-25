"use client";

import { ReactNode } from "react";
import Link from "next/link";

export default function EmptyState({
  icon,
  title,
  description,
  actionHref,
  actionLabel,
  onAction,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const button = actionLabel ? (
    actionHref ? (
      <Link
        href={actionHref}
        className="cursor-pointer inline-flex items-center gap-2 px-5 h-11 bg-sky-700 hover:bg-sky-800 text-white rounded-lg font-medium text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
      >
        {actionLabel}
      </Link>
    ) : (
      <button
        type="button"
        onClick={onAction}
        className="cursor-pointer inline-flex items-center gap-2 px-5 h-11 bg-sky-700 hover:bg-sky-800 text-white rounded-lg font-medium text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
      >
        {actionLabel}
      </button>
    )
  ) : null;
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-6 py-12 text-center shadow-card">
      {icon && (
        <div className="w-14 h-14 mx-auto mb-4 inline-flex items-center justify-center rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
          {icon}
        </div>
      )}
      <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">{title}</h2>
      {description && (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">{description}</p>
      )}
      {button && <div className="mt-6">{button}</div>}
    </div>
  );
}
