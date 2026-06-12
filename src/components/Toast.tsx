"use client";

import { createContext, ReactNode, useCallback, useContext, useState } from "react";
import { CheckIcon, XIcon } from "./icons";

type ToastKind = "success" | "error";
type ToastAction = { label: string; onClick: () => void };
type Toast = { id: string; kind: ToastKind; message: string; action?: ToastAction };

type ToastApi = {
  show: (message: string, kind?: ToastKind) => void;
  showWithAction: (message: string, action: ToastAction, kind?: ToastKind) => void;
};

const ToastCtx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Her toast kendi timeout'una sahip — tek paylaşılan timer art arda gelen
  // toast'larda (örn. online + "gönderildi" + "gönderilemedi") en kritik
  // mesajı erken düşürüyordu.
  const push = useCallback((toast: Toast) => {
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((p) => p.filter((t) => t.id !== toast.id));
    }, 6000);
  }, []);

  const show = useCallback(
    (message: string, kind: ToastKind = "success") => {
      push({ id: crypto.randomUUID(), kind, message });
    },
    [push]
  );

  const showWithAction = useCallback(
    (message: string, action: ToastAction, kind: ToastKind = "success") => {
      push({ id: crypto.randomUUID(), kind, message, action });
    },
    [push]
  );

  function dismiss(id: string) {
    setToasts((p) => p.filter((t) => t.id !== id));
  }

  return (
    <ToastCtx.Provider value={{ show, showWithAction }}>
      {children}
      <div
        className="fixed top-[max(1rem,env(safe-area-inset-top))] right-4 z-[60] flex flex-col gap-2 pointer-events-none max-w-[calc(100%-2rem)]"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => {
          const isSuccess = t.kind === "success";
          return (
            <div
              key={t.id}
              // Hata toast'ları assertive olmalı — "sipariş gönderilemedi"
              // ekran okuyucuda kuyrukta beklememeli.
              role={isSuccess ? "status" : "alert"}
              className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border animate-in slide-in-from-top-2 fade-in duration-200 ${
                isSuccess
                  ? "bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-900 text-slate-900 dark:text-slate-100"
                  : "bg-white dark:bg-slate-900 border-red-200 dark:border-red-900 text-slate-900 dark:text-slate-100"
              }`}
            >
              <span
                className={`flex-shrink-0 w-6 h-6 rounded-full inline-flex items-center justify-center text-white ${
                  isSuccess ? "bg-emerald-500" : "bg-red-500"
                }`}
                aria-hidden="true"
              >
                {isSuccess ? <CheckIcon width={14} height={14} strokeWidth={3} /> : <XIcon width={14} height={14} strokeWidth={3} />}
              </span>
              <span className="flex-1">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                  className="cursor-pointer text-sky-700 dark:text-sky-400 font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 rounded"
                >
                  {t.action.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
