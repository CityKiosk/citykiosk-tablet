export type DisplayFields = {
  name: boolean;
  description: boolean;
  sku: boolean;
  dimensions: boolean;
  price: boolean;
  packagingUnit: boolean;
};

export const DISPLAY_FIELD_DEFAULTS: DisplayFields = {
  name: true,
  description: true,
  sku: true,
  dimensions: true,
  price: true,
  packagingUnit: true,
};

export const DISPLAY_FIELD_KEYS: ReadonlyArray<keyof DisplayFields> = [
  "name",
  "description",
  "sku",
  "dimensions",
  "price",
  "packagingUnit",
];

/** Where the fields apply:
 *  - "catalog": owner-facing /catalog (used while building orders)
 *  - "browse":  customer-facing /browse (vitrin) and public share link /v/[token]
 */
export type DisplayFieldScope = "catalog" | "browse";

export const DISPLAY_FIELD_SCOPES: ReadonlyArray<DisplayFieldScope> = ["catalog", "browse"];

/** Both scopes together, used by the provider and server-side fetch. */
export type DisplayFieldsByScope = Record<DisplayFieldScope, DisplayFields>;

export const DISPLAY_FIELDS_BY_SCOPE_DEFAULTS: DisplayFieldsByScope = {
  catalog: DISPLAY_FIELD_DEFAULTS,
  browse: DISPLAY_FIELD_DEFAULTS,
};
