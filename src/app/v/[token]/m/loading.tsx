export default function PublicMobileCatalogLoading() {
  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950">
      <div className="sticky top-0 z-30 bg-white/85 dark:bg-slate-900/85 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="h-12 px-3 flex items-center justify-center">
          <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="px-3 pb-2">
          <div className="h-10 w-full bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
        </div>
        <div className="px-3 py-2 flex gap-1.5 border-t border-slate-200 dark:border-slate-800">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"
            />
          ))}
        </div>
      </div>
      <div className="px-3 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl overflow-hidden">
            <div className="aspect-square bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="px-2.5 py-2 space-y-1.5">
              <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
