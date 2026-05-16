export default function PublicProductDetailLoading() {
  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950">
      <div className="sticky top-0 z-30 bg-white/85 dark:bg-slate-900/85 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="h-12 px-2 flex items-center justify-between gap-2">
          <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
          <div className="h-9 w-9 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-3 pb-16">
        <div className="mt-3 aspect-square w-full bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
        <div className="mt-5 space-y-2">
          <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          <div className="h-6 w-2/3 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse mt-2" />
        </div>
      </div>
    </div>
  );
}
