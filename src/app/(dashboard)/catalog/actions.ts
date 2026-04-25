"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePinUnlocked } from "@/lib/pinSession";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Update Product ──
const UpdateProductSchema = z.object({
  id: z.string().uuid(),
  name_tr: z.string().min(1, "Name (TR) erforderlich"),
  name_de: z.string().optional(),
  price: z.coerce.number().min(0, "Preis muss ≥ 0 sein"),
  category_id: z.string().uuid().optional().nullable(),
  description_tr: z.string().optional(),
  description_de: z.string().optional(),
  image_url: z.string().transform((val) => val.trim()).refine(
    (val) => {
      const lower = val.toLowerCase();
      return !lower.startsWith("javascript:") && !lower.startsWith("vbscript:") && !lower.startsWith("data:text/");
    },
    { message: "Invalid image URL" }
  ).optional().nullable(),
  sku: z.string().optional().nullable(),
  dimensions: z.string().optional().nullable(),
  packaging_unit: z.coerce.number().int().optional().nullable(),
  stock: z.coerce.number().int().gte(-9999).lte(999999).optional(),
});

export type UpdateProductState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function updateProduct(
  _prev: UpdateProductState,
  formData: FormData,
): Promise<UpdateProductState> {
  const stockRaw = formData.get("stock");
  const parsed = UpdateProductSchema.safeParse({
    id: formData.get("id"),
    name_tr: formData.get("name_tr"),
    name_de: formData.get("name_de") || undefined,
    price: formData.get("price"),
    category_id: formData.get("category_id") || null,
    description_tr: formData.get("description_tr") || undefined,
    description_de: formData.get("description_de") || undefined,
    image_url: formData.get("image_url") || undefined,
    sku: formData.get("sku") || null,
    dimensions: formData.get("dimensions") || null,
    packaging_unit: formData.get("packaging_unit") || null,
    stock: stockRaw === null || stockRaw === "" ? undefined : stockRaw,
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet / Giriş yapılmamış" };

  const gate = await requirePinUnlocked("settings");
  if (gate) return { error: "PIN erforderlich / PIN gerekli" };

  const { error } = await supabase
    .from("products")
    .update({
      name_tr: parsed.data.name_tr,
      name_de: parsed.data.name_de || null,
      price: parsed.data.price,
      category_id: parsed.data.category_id,
      description_tr: parsed.data.description_tr || null,
      description_de: parsed.data.description_de || null,
      ...(parsed.data.image_url !== undefined ? { image_url: parsed.data.image_url } : {}),
      sku: parsed.data.sku || null,
      dimensions: parsed.data.dimensions || null,
      packaging_unit: parsed.data.packaging_unit || null,
      ...(parsed.data.stock !== undefined ? { stock: parsed.data.stock } : {}),
    })
    .eq("id", parsed.data.id)
    .eq("owner_id", user.id);

  if (error) {
    return { error: "Speichern fehlgeschlagen / Kaydetme başarısız" };
  }

  revalidatePath("/catalog");
  revalidatePath("/stock");
  revalidatePath("/", "layout");
  return { success: true };
}

// ── Delete Product (hard delete) ──
export async function deleteProduct(productId: string): Promise<{ error?: string }> {
  const parsed = z.string().uuid().safeParse(productId);
  if (!parsed.success) return { error: "Ungültige Produkt-ID" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const gate = await requirePinUnlocked("settings");
  if (gate) return { error: "PIN erforderlich" };

  // Delete image from storage
  const { data: product } = await supabase
    .from("products")
    .select("image_url")
    .eq("id", productId)
    .eq("owner_id", user.id)
    .single();

  if (product?.image_url) {
    const marker = "/product-images/";
    const idx = product.image_url.indexOf(marker);
    if (idx !== -1) {
      const path = product.image_url.substring(idx + marker.length).split("?")[0];
      if (path && path.length > 0) {
        await supabase.storage.from("product-images").remove([path]);
      }
    }
  }

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("owner_id", user.id);

  if (error) return { error: "Löschen fehlgeschlagen / Silme başarısız" };

  revalidatePath("/catalog");
  return {};
}

// ── Add Category ──
const AddCategorySchema = z.object({
  name_tr: z.string().min(1),
  name_de: z.string().optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Nur Kleinbuchstaben, Zahlen und Bindestriche"),
});

/** Slug helper — Latin-1 fold, lowercase, dash-collapse. Mirrors the
 *  client-side rules used in AddCategoryDialog so DE inputs like
 *  "Magnete für Kühlschrank" become "magnete-fur-kuhlschrank". */
function slugifyForCategory(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const QuickCategorySchema = z.object({
  name_de: z.string().min(1, "Name erforderlich").max(100),
});

/**
 * Single-input category create used by the inline picker inside ProductForm.
 * Owner only types the German name; we mirror it into name_tr (DB requires
 * NOT NULL there) so the locale fallback chain still works. Slug is derived
 * from the input. Returns the new id so the caller can auto-select it in
 * the dropdown without a roundtrip.
 */
export async function addCategoryQuick(nameDe: string): Promise<{ id?: string; error?: string }> {
  const parsed = QuickCategorySchema.safeParse({ name_de: nameDe });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Ungültige Eingabe" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const gate = await requirePinUnlocked("settings");
  if (gate) return { error: "PIN erforderlich" };

  const trimmed = parsed.data.name_de.trim();
  let slug = slugifyForCategory(trimmed);
  if (!slug) {
    // Fallback for inputs that slugify to empty (pure non-Latin scripts) —
    // give it a unique numeric tail so the (owner_id, slug) unique can land.
    slug = `cat-${Date.now()}`;
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      name_tr: trimmed,
      name_de: trimmed,
      slug,
      owner_id: user.id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Kategorie existiert bereits / Kategori zaten var" };
    return { error: "Fehler beim Erstellen" };
  }

  revalidatePath("/settings");
  revalidatePath("/catalog");
  return { id: data.id };
}

export async function addCategory(
  _prev: { success?: boolean; error?: string },
  formData: FormData,
) {
  const parsed = AddCategorySchema.safeParse({
    name_tr: formData.get("name_tr"),
    name_de: formData.get("name_de") || undefined,
    slug: formData.get("slug"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Ungültige Eingabe" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const gate = await requirePinUnlocked("settings");
  if (gate) return { error: "PIN erforderlich" };

  const { error } = await supabase.from("categories").insert({
    name_tr: parsed.data.name_tr,
    name_de: parsed.data.name_de || null,
    slug: parsed.data.slug,
    owner_id: user.id,
  });

  if (error) {
    if (error.code === "23505") return { error: "Kategorie existiert bereits / Kategori zaten var" };
    return { error: "Fehler beim Erstellen / Oluşturma hatası" };
  }

  revalidatePath("/catalog");
  return { success: true };
}

// ── Fetch products + categories for CartSheet ──
export type CartProduct = {
  id: string;
  name_tr: string;
  name_de: string | null;
  price: number;
  image_url: string | null;
  category_id: string | null;
  sku: string | null;
  description_tr: string | null;
  description_de: string | null;
  stock: number;
};

export type CartCategory = {
  id: string;
  name_tr: string;
  name_de: string | null;
};

export async function fetchCartProducts(): Promise<{
  products?: CartProduct[];
  categories?: CartCategory[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const [prodRes, catRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name_tr, name_de, price, image_url, category_id, sku, description_tr, description_de, stock")
      .eq("is_active", true)
      .eq("owner_id", user.id),
    supabase
      .from("categories")
      .select("id, name_tr, name_de")
      .eq("is_active", true)
      .eq("owner_id", user.id),
  ]);

  if (prodRes.error || catRes.error) return { error: "Daten konnten nicht geladen werden" };
  return { products: prodRes.data ?? [], categories: catRes.data ?? [] };
}

// ── Fetch categories for Settings ──
export type SettingsCategory = {
  id: string;
  name_tr: string;
  name_de: string | null;
  slug: string;
  sort_order: number;
  is_active: boolean;
};

export async function fetchCategories(): Promise<{ data?: SettingsCategory[]; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const { data, error } = await supabase
    .from("categories")
    .select("id, name_tr, name_de, slug, sort_order, is_active")
    .eq("owner_id", user.id)
    .order("name_de", { ascending: true });

  if (error) return { error: "Kategorien konnten nicht geladen werden" };
  return { data: data ?? [] };
}

// ── Delete Category ──
export async function deleteCategory(categoryId: string): Promise<{ error?: string }> {
  const parsed = z.string().uuid().safeParse(categoryId);
  if (!parsed.success) return { error: "Ungültige Kategorie-ID" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const gate = await requirePinUnlocked("settings");
  if (gate) return { error: "PIN erforderlich" };

  // Check if any products use this category
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId)
    .eq("owner_id", user.id);

  if (count && count > 0) {
    return { error: `Kategorie hat noch ${count} Produkte — bitte zuerst Produkte verschieben` };
  }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId)
    .eq("owner_id", user.id);

  if (error) return { error: "Löschen fehlgeschlagen" };
  revalidatePath("/settings");
  revalidatePath("/catalog");
  return {};
}

// ── Fetch products for Settings ──
export type SettingsProduct = {
  id: string;
  name_tr: string;
  name_de: string | null;
  price: number;
  image_url: string | null;
  category_id: string | null;
  dimensions: string | null;
  packaging_unit: number | null;
  description_tr: string | null;
  description_de: string | null;
  sku: string | null;
  is_active: boolean;
  sort_order: number;
  stock: number;
};

export async function fetchProducts(): Promise<{ data?: SettingsProduct[]; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const { data, error } = await supabase
    .from("products")
    .select("id, name_tr, name_de, price, image_url, category_id, dimensions, packaging_unit, description_tr, description_de, sku, is_active, sort_order, stock")
    .eq("owner_id", user.id)
    .order("sort_order", { ascending: true });

  if (error) return { error: "Produkte konnten nicht geladen werden" };
  return { data: data ?? [] };
}

// ── Add Product ──
const AddProductSchema = z.object({
  name_tr: z.string().min(1, "Name (TR) erforderlich"),
  name_de: z.string().optional(),
  price: z.coerce.number().min(0, "Preis muss ≥ 0 sein"),
  category_id: z.string().uuid().optional().nullable(),
  description_tr: z.string().optional(),
  description_de: z.string().optional(),
  image_url: z.string().transform((val) => val.trim()).refine(
    (val) => {
      const lower = val.toLowerCase();
      return !lower.startsWith("javascript:") && !lower.startsWith("vbscript:") && !lower.startsWith("data:text/");
    },
    { message: "Invalid image URL" }
  ).optional().nullable(),
  dimensions: z.string().optional().nullable(),
  packaging_unit: z.coerce.number().int().optional().nullable(),
  sku: z.string().optional().nullable(),
  stock: z.coerce.number().int().gte(-9999).lte(999999).optional(),
});

export async function addProduct(input: {
  name_tr: string;
  name_de?: string;
  price: number;
  category_id?: string | null;
  description_tr?: string;
  description_de?: string;
  image_url?: string | null;
  dimensions?: string | null;
  packaging_unit?: number | null;
  sku?: string | null;
  stock?: number;
}): Promise<{ id?: string; error?: string }> {
  const parsed = AddProductSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Ungültige Eingabe" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  const gate = await requirePinUnlocked("settings");
  if (gate) return { error: "PIN erforderlich" };

  const { data, error } = await supabase
    .from("products")
    .insert({
      owner_id: user.id,
      name_tr: parsed.data.name_tr,
      name_de: parsed.data.name_de || null,
      price: parsed.data.price,
      category_id: parsed.data.category_id || null,
      description_tr: parsed.data.description_tr || null,
      description_de: parsed.data.description_de || null,
      image_url: parsed.data.image_url || null,
      dimensions: parsed.data.dimensions || null,
      packaging_unit: parsed.data.packaging_unit || null,
      sku: parsed.data.sku || null,
      ...(parsed.data.stock !== undefined ? { stock: parsed.data.stock } : {}),
    })
    .select("id")
    .single();

  if (error) return { error: "Produkt konnte nicht erstellt werden" };
  revalidatePath("/settings");
  revalidatePath("/catalog");
  revalidatePath("/stock");
  revalidatePath("/", "layout");
  return { id: data.id };
}
