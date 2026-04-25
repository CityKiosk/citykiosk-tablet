export default function OrdersLoading() {
  return (
    <div>
      <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse mb-6" />
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-3 w-1/4 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
