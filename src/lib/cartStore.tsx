"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

const STORAGE_KEY = "souvenir_cart_v1";

type Quantities = Record<string, number>;

type Store = {
  get: () => Quantities;
  set: (next: Quantities) => void;
  subscribe: (cb: () => void) => () => void;
};

function createStore(): Store {
  let state: Quantities = {};
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (next) => {
      state = next;
      listeners.forEach((l) => l());
    },
    subscribe: (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}

const Ctx = createContext<Store | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<Store | null>(null);
  if (!storeRef.current) storeRef.current = createStore();
  const store = storeRef.current;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) store.set(JSON.parse(raw));
    } catch {}

    // Persist on state change
    const unsub = store.subscribe(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store.get()));
      } catch {}
    });

    // Cross-tab sync: update store when another tab writes to localStorage
    function handleStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        store.set(JSON.parse(e.newValue));
      } catch {}
    }
    window.addEventListener("storage", handleStorage);

    return () => {
      unsub();
      window.removeEventListener("storage", handleStorage);
    };
  }, [store]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useCart must be used within CartProvider");
  return s;
}

/** Subscribe to a single product's quantity. Re-renders only when that qty changes. */
export function useProductQty(id: string): [number, (v: number) => void] {
  const store = useStore();
  const qty = useSyncExternalStore(
    store.subscribe,
    () => store.get()[id] || 0,
    () => 0
  );
  const setQty = useCallback(
    (v: number) => {
      const cur = store.get();
      const value = Math.max(0, Math.floor(v));
      const next = { ...cur };
      if (value === 0) delete next[id];
      else next[id] = value;
      store.set(next);
    },
    [store, id]
  );
  return [qty, setQty];
}

const EMPTY: Quantities = {};

/** Full cart access for the cart sheet. */
export function useCart() {
  const store = useStore();
  const quantities = useSyncExternalStore(
    store.subscribe,
    () => store.get(),
    () => EMPTY
  );
  const setQty = useCallback(
    (id: string, v: number) => {
      const cur = store.get();
      const value = Math.max(0, Math.floor(v));
      const next = { ...cur };
      if (value === 0) delete next[id];
      else next[id] = value;
      store.set(next);
    },
    [store]
  );
  const clear = useCallback(() => store.set({}), [store]);
  const { totalCount, kindCount } = useMemo(() => {
    let total = 0;
    let kinds = 0;
    for (const v of Object.values(quantities)) {
      if (v > 0) {
        total += v;
        kinds++;
      }
    }
    return { totalCount: total, kindCount: kinds };
  }, [quantities]);
  return { quantities, setQty, clear, totalCount, kindCount };
}
