export default function BrowseLoading() {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="w-[595px] max-w-[90vw] aspect-[595/842] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
    </div>
  );
}
