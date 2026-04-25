export default function OrderDetailLoading() {
  return (
    <div>
      <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse mb-4" />
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 mb-6 animate-pulse">
        <div className="flex flex-col md:flex-row md:justify-between gap-4">
          <div className="space-y-3">
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-7 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
          <div className="space-y-3">
            <div className="h-10 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="flex gap-2">
              <div className="h-10 w-28 bg-slate-200 dark:bg-slate-700 rounded-lg" />
              <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-4 p-4 border-b border-slate-200 dark:border-slate-800 animate-pulse">
            <div className="w-18 h-18 bg-slate-100 dark:bg-slate-800 rounded-lg flex-shrink-0" style={{ width: "4.5rem", height: "4.5rem" }} />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-1/3 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-1/4 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
