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
const DISCOUNT_STORAGE_KEY = "souvenir_cart_discount_v1";

type Quantities = Record<string, number>;

type Store = {
  get: () => Quantities;
  set: (next: Quantities) => void;
  subscribe: (cb: () => void) => () => void;
};

type DiscountStore = {
  get: () => number;
  set: (next: number) => void;
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

function createDiscountStore(): DiscountStore {
  let state = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (next) => {
      const clamped = Math.max(0, Math.min(20, Math.trunc(next)));
      if (clamped === state) return;
      state = clamped;
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
const DiscountCtx = createContext<DiscountStore | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<Store | null>(null);
  if (!storeRef.current) storeRef.current = createStore();
  const store = storeRef.current;

  const discountRef = useRef<DiscountStore | null>(null);
  if (!discountRef.current) discountRef.current = createDiscountStore();
  const discountStore = discountRef.current;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) store.set(JSON.parse(raw));
    } catch {}
    try {
      const rawDisc = localStorage.getItem(DISCOUNT_STORAGE_KEY);
      if (rawDisc) discountStore.set(Number(rawDisc));
    } catch {}

    // Persist on state change
    const unsub = store.subscribe(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store.get()));
      } catch {}
    });
    const unsubDiscount = discountStore.subscribe(() => {
      try {
        localStorage.setItem(DISCOUNT_STORAGE_KEY, String(discountStore.get()));
      } catch {}
    });

    // Cross-tab sync: update store when another tab writes to localStorage
    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue) {
        try { store.set(JSON.parse(e.newValue)); } catch {}
      } else if (e.key === DISCOUNT_STORAGE_KEY && e.newValue) {
        discountStore.set(Number(e.newValue));
      }
    }
    window.addEventListener("storage", handleStorage);

    return () => {
      unsub();
      unsubDiscount();
      window.removeEventListener("storage", handleStorage);
    };
  }, [store, discountStore]);

  return (
    <Ctx.Provider value={store}>
      <DiscountCtx.Provider value={discountStore}>{children}</DiscountCtx.Provider>
    </Ctx.Provider>
  );
}

function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useCart must be used within CartProvider");
  return s;
}

function useDiscountStore(): DiscountStore {
  const s = useContext(DiscountCtx);
  if (!s) throw new Error("useCartDiscount must be used within CartProvider");
  return s;
}

/** Order-level discount percentage (0..20). Reset to 0 when the cart clears. */
export function useCartDiscount(): [number, (pct: number) => void] {
  const store = useDiscountStore();
  const pct = useSyncExternalStore(store.subscribe, store.get, () => 0);
  const setPct = useCallback((v: number) => store.set(v), [store]);
  return [pct, setPct];
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
  const discountStore = useDiscountStore();
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
  const clear = useCallback(() => {
    store.set({});
    // Reset the order-level discount alongside the cart so it doesn't carry
    // over into the next customer's order.
    discountStore.set(0);
  }, [store, discountStore]);
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
