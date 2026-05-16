"use client";

// ============================================================================
// useCatalogListState — sessionStorage-backed filter/pagination state
// ============================================================================
// Why a custom hook: when a customer drills from /m into /p/[id] and taps
// back, the list component unmounts and remounts — all useState is reset.
// React's Router Cache restores the server HTML but not local component
// state, so the customer would see their search/filter/scroll reset every
// time. Persisting these to sessionStorage (per share token) makes back-
// navigation feel like the list "stayed open".
//
// Single responsibility: own the persisted filter state. The component
// reads/writes through this hook and doesn't think about storage.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";

export const DEFAULT_PAGE_BATCH = 24;

type Persisted = {
  search: string;
  activeCat: string;
  visibleCount: number;
};

const DEFAULTS: Persisted = {
  search: "",
  activeCat: "all",
  visibleCount: DEFAULT_PAGE_BATCH,
};

function storageKey(token: string) {
  return `souvenir_public_list:${token}`;
}

function readPersisted(token: string): Persisted {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = sessionStorage.getItem(storageKey(token));
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      search: typeof parsed.search === "string" ? parsed.search : DEFAULTS.search,
      activeCat: typeof parsed.activeCat === "string" ? parsed.activeCat : DEFAULTS.activeCat,
      visibleCount:
        typeof parsed.visibleCount === "number" && parsed.visibleCount > 0
          ? parsed.visibleCount
          : DEFAULTS.visibleCount,
    };
  } catch {
    return DEFAULTS;
  }
}

export function useCatalogListState(token: string) {
  // Defer reading sessionStorage until after mount to avoid SSR hydration
  // mismatch — the server has no sessionStorage, so it must render defaults.
  const [search, setSearch] = useState(DEFAULTS.search);
  const [activeCat, setActiveCat] = useState(DEFAULTS.activeCat);
  const [visibleCount, setVisibleCount] = useState(DEFAULTS.visibleCount);
  const hydratedRef = useRef(false);

  useEffect(() => {
    const persisted = readPersisted(token);
    setSearch(persisted.search);
    setActiveCat(persisted.activeCat);
    setVisibleCount(persisted.visibleCount);
    hydratedRef.current = true;
  }, [token]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      sessionStorage.setItem(
        storageKey(token),
        JSON.stringify({ search, activeCat, visibleCount }),
      );
    } catch {}
  }, [token, search, activeCat, visibleCount]);

  // Convenience: filter changes also reset pagination to first batch.
  const setSearchAndReset = useCallback((next: string) => {
    setSearch(next);
    setVisibleCount(DEFAULT_PAGE_BATCH);
  }, []);

  const setActiveCatAndReset = useCallback((next: string) => {
    setActiveCat(next);
    setVisibleCount(DEFAULT_PAGE_BATCH);
  }, []);

  const reset = useCallback(() => {
    setSearch(DEFAULTS.search);
    setActiveCat(DEFAULTS.activeCat);
    setVisibleCount(DEFAULT_PAGE_BATCH);
  }, []);

  const loadMore = useCallback(() => {
    setVisibleCount((c) => c + DEFAULT_PAGE_BATCH);
  }, []);

  return {
    search,
    activeCat,
    visibleCount,
    setSearch: setSearchAndReset,
    setActiveCat: setActiveCatAndReset,
    reset,
    loadMore,
  };
}
