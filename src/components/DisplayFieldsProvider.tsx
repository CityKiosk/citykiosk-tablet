"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { updateDisplayField } from "@/app/(dashboard)/settings/actions";
import {
  DISPLAY_FIELDS_BY_SCOPE_DEFAULTS,
  type DisplayFields,
  type DisplayFieldScope,
  type DisplayFieldsByScope,
} from "@/lib/displayFields";

export type { DisplayFields, DisplayFieldScope };

const LEGACY_STORAGE_KEY = "souvenir_display_fields";

type Ctx = {
  byScope: DisplayFieldsByScope;
  setField: (
    scope: DisplayFieldScope,
    key: keyof DisplayFields,
    value: boolean,
  ) => Promise<{ error?: string }>;
};

const DisplayFieldsCtx = createContext<Ctx | null>(null);

export function DisplayFieldsProvider({
  initial,
  children,
}: {
  /** Server-fetched values for both scopes. Falls back to all-on if omitted. */
  initial?: DisplayFieldsByScope;
  children: ReactNode;
}) {
  const [byScope, setByScope] = useState<DisplayFieldsByScope>(
    initial ?? DISPLAY_FIELDS_BY_SCOPE_DEFAULTS,
  );

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {}
  }, []);

  const setField = useCallback(
    async (
      scope: DisplayFieldScope,
      key: keyof DisplayFields,
      value: boolean,
    ): Promise<{ error?: string }> => {
      // Optimistic: flip the value locally, revert on RPC failure.
      let previous = false;
      setByScope((prev) => {
        previous = prev[scope][key];
        return { ...prev, [scope]: { ...prev[scope], [key]: value } };
      });
      const result = await updateDisplayField(scope, key, value);
      if (result.error) {
        setByScope((prev) => ({
          ...prev,
          [scope]: { ...prev[scope], [key]: previous },
        }));
        return { error: result.error };
      }
      return {};
    },
    [],
  );

  return (
    <DisplayFieldsCtx.Provider value={{ byScope, setField }}>
      {children}
    </DisplayFieldsCtx.Provider>
  );
}

/**
 * Read the display-fields configuration for a specific view.
 * - Pass "catalog" from /catalog (ProductCard)
 * - Pass "browse"  from /browse  (BrowseCatalogClient)
 *
 * Settings UI calls with the scope whose toggle was flipped.
 */
export function useDisplayFields(scope: DisplayFieldScope): {
  fields: DisplayFields;
  setField: (key: keyof DisplayFields, value: boolean) => Promise<{ error?: string }>;
} {
  const ctx = useContext(DisplayFieldsCtx);
  if (!ctx) throw new Error("useDisplayFields must be used within DisplayFieldsProvider");
  return {
    fields: ctx.byScope[scope],
    setField: (key, value) => ctx.setField(scope, key, value),
  };
}
