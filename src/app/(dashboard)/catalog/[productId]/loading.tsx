export default function ProductDetailLoading() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
          <div className="h-9 w-28 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="grid md:grid-cols-2 gap-0">
          <div className="aspect-square bg-slate-100 dark:bg-slate-800 animate-pulse" />
          <div className="p-6 lg:p-8 space-y-4">
            <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-8 w-3/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-10 w-1/3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-12 w-48 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse mt-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
