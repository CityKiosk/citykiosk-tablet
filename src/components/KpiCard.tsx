import { ReactNode } from "react";

export default function KpiCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  hint?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {label}
          </div>
          <div className="tabular mt-2 text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-50 break-words">
            {value}
          </div>
          {hint && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div>}
        </div>
        {icon && (
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 inline-flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
