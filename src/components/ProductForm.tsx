"use client";

import { useState, useTransition } from "react";
import Modal from "./Modal";
import { useI18n } from "./I18nProvider";
import { resizeImageToBlob } from "@/lib/image";
import { CameraIcon, ChevronLeftIcon, ChevronRightIcon, ImageIcon, Loader2Icon, RotateCcwIcon, Trash2Icon, XIcon } from "./icons";
import {
  addProduct,
  updateProduct,
  type SettingsCategory,
  type SettingsProduct,
} from "@/app/(dashboard)/catalog/actions";
import { createClient } from "@/lib/supabase/client";

type CommonProps = {
  categories: SettingsCategory[];
  existingDimensions?: string[];
  onClose: () => void;
  onSaved: (nextTarget?: SettingsProduct) => void;
};

type AddProps = CommonProps & { mode: "add"; initial?: undefined };
type EditProps = CommonProps & {
  mode: "edit";
  initial: SettingsProduct;
  prev?: SettingsProduct | null;
  next?: SettingsProduct | null;
  position?: { current: number; total: number };
  onNavigate?: (target: SettingsProduct, dirty: boolean) => void;
  onDelete?: (product: SettingsProduct) => void;
};

export default function ProductForm(props: AddProps | EditProps) {
  const { t, locale } = useI18n();
  const { categories, existingDimensions = [], onClose, onSaved } = props;
  const initial = props.mode === "edit" ? props.initial : undefined;
  const prev = props.mode === "edit" ? props.prev ?? null : null;
  const next = props.mode === "edit" ? props.next ?? null : null;
  const position = props.mode === "edit" ? props.position : undefined;
  const onNavigate = props.mode === "edit" ? props.onNavigate : undefined;
  const onDelete = props.mode === "edit" ? props.onDelete : undefined;
  const dimPresets = [...new Set([...existingDimensions, ...(initial?.dimensions ? [initial.dimensions] : [])])].sort((a, b) => a.localeCompare(b, "de", { numeric: true }));

  const initialNameDe = initial?.name_de || initial?.name_tr || "";
  const initialDescDe = initial?.description_de || initial?.description_tr || "";
  const initialImageUrl = initial?.image_url || "";
  const initialCategoryId = initial?.category_id || categories[0]?.id || "";
  const initialPrice = initial?.price || 0;
  const initialDim = initial?.dimensions || "";
  const initialVe = initial?.packaging_unit || 0;
  const initialSku = initial?.sku || "";

  const [nameDe, setNameDe] = useState(initialNameDe);
  const [descDe, setDescDe] = useState(initialDescDe);
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [price, setPrice] = useState<number>(initialPrice);
  const [dim, setDim] = useState(initialDim);
  const [dimCustom, setDimCustom] = useState(!!(initial?.dimensions && !dimPresets.includes(initial.dimensions)));
  const [ve, setVe] = useState<number>(initialVe);
  const [sku, setSku] = useState(initialSku);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saveAndNextPending, setSaveAndNextPending] = useState(false);

  const isDirty =
    nameDe !== initialNameDe ||
    descDe !== initialDescDe ||
    imageUrl !== initialImageUrl ||
    categoryId !== initialCategoryId ||
    price !== initialPrice ||
    dim !== initialDim ||
    ve !== initialVe ||
    sku !== initialSku;

  function getName(c: SettingsCategory): string {
    return locale === "de" && c.name_de ? c.name_de : c.name_tr;
  }

  const [uploading, setUploading] = useState(false);
  const [rotateSuccess, setRotateSuccess] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const blob = await resizeImageToBlob(file, 1600);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const fileName = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("product-images")
        .upload(fileName, blob, { contentType: "image/jpeg", upsert: false });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);
      setImageUrl(urlData.publicUrl);
    } catch {
      setError(t.add.photoErr);
    } finally {
      setUploading(false);
    }
  }

  async function handleRotate() {
    if (!imageUrl || uploading) return;
    setUploading(true);
    setError(null);
    try {
      // Load image, rotate 90° clockwise on canvas
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = imageUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext("2d")!;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/jpeg",
          0.85
        );
      });
      // Upload rotated image
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const fileName = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("product-images")
        .upload(fileName, blob, { contentType: "image/jpeg", upsert: false });
      if (uploadErr) throw uploadErr;
      // Delete old image to prevent orphaned blobs
      const oldUrl = imageUrl;
      const marker = "/product-images/";
      const markerIdx = oldUrl.indexOf(marker);
      if (markerIdx !== -1) {
        const oldPath = oldUrl.substring(markerIdx + marker.length).split("?")[0];
        if (oldPath) supabase.storage.from("product-images").remove([oldPath]);
      }
      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);
      setImageUrl(urlData.publicUrl);
      setRotateSuccess(true);
      setTimeout(() => setRotateSuccess(false), 2000);
    } catch {
      setError(t.add.photoErr);
    } finally {
      setUploading(false);
    }
  }

  function handleSave(goToNext: boolean) {
    if (isPending || uploading) return;
    const name = nameDe.trim();
    const desc = descDe.trim();
    if (!name || !imageUrl.trim() || price <= 0) {
      setError(t.add.validationErr);
      return;
    }

    if (goToNext) setSaveAndNextPending(true);

    startTransition(async () => {
      if (props.mode === "add") {
        const result = await addProduct({
          name_tr: name,
          name_de: name,
          price,
          category_id: categoryId || null,
          description_tr: desc || undefined,
          description_de: desc || undefined,
          image_url: imageUrl.trim() || null,
          dimensions: dim.trim() || null,
          packaging_unit: ve > 0 ? ve : null,
          sku: sku.trim() || null,
        });
        if (result.error) {
          setError(result.error);
          setSaveAndNextPending(false);
          return;
        }
      } else {
        const formData = new FormData();
        formData.set("id", initial!.id);
        formData.set("name_tr", name);
        formData.set("name_de", name);
        formData.set("price", String(price));
        formData.set("category_id", categoryId || "");
        formData.set("description_tr", desc);
        formData.set("description_de", desc);
        if (imageUrl) formData.set("image_url", imageUrl.trim());
        formData.set("sku", sku.trim());
        formData.set("dimensions", dim.trim());
        formData.set("packaging_unit", ve > 0 ? String(ve) : "");
        const result = await updateProduct({}, formData);
        if (result.error || result.fieldErrors) {
          setError(result.error || "Validierungsfehler");
          setSaveAndNextPending(false);
          return;
        }
      }
      setSaveAndNextPending(false);
      onSaved(goToNext && next ? next : undefined);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSave(false);
  }

  function handleNavClick(target: SettingsProduct) {
    if (uploading || isPending) return;
    if (onNavigate) onNavigate(target, isDirty);
  }

  const titleText = props.mode === "add" ? t.add.title : t.catalog.editProduct;
  const inputCls =
    "w-full h-11 px-3 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-shadow";

  const showFieldErrors = !!error;
  const invalidName = showFieldErrors && !nameDe.trim();
  const invalidPrice = showFieldErrors && price <= 0;
  const invalidImage = showFieldErrors && !imageUrl.trim();

  const showNav = props.mode === "edit" && position && position.total > 1;
  const prevName = prev ? (locale === "de" && prev.name_de ? prev.name_de : prev.name_tr) : "";
  const nextName = next ? (locale === "de" && next.name_de ? next.name_de : next.name_tr) : "";
  const navBtnBase =
    "inline-flex items-center gap-1 h-9 px-2.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-transparent";

  return (
    <Modal title={titleText} onClose={onClose} size="lg">
      {showNav && (
        <div className="px-6 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => prev && handleNavClick(prev)}
            disabled={!prev || uploading || isPending}
            aria-label={prev ? t.add2.prevItem(prevName) : t.add2.prevItem("")}
            className={`cursor-pointer ${navBtnBase}`}
          >
            <ChevronLeftIcon width={14} height={14} />
            <span className="hidden sm:inline max-w-[14ch] truncate">{prevName || t.add2.prevItem("").replace(":", "").trim()}</span>
          </button>
          <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400" aria-live="polite">
            {t.add2.itemPosition(position!.current, position!.total)}
          </span>
          <button
            type="button"
            onClick={() => next && handleNavClick(next)}
            disabled={!next || uploading || isPending}
            aria-label={next ? t.add2.nextItem(nextName) : t.add2.nextItem("")}
            className={`cursor-pointer ${navBtnBase}`}
          >
            <span className="hidden sm:inline max-w-[14ch] truncate">{nextName || t.add2.nextItem("").replace(":", "").trim()}</span>
            <ChevronRightIcon width={14} height={14} />
          </button>
        </div>
      )}
      <form id="pf-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4" noValidate>
        {error && (
          <div
            id="pf-error"
            role="alert"
            className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm border border-red-200 dark:border-red-900"
          >
            {error}
          </div>
        )}
        <Field label={t.add.name} required htmlFor="pf-name-de">
          <input
            id="pf-name-de"
            type="text"
            value={nameDe}
            onChange={(e) => setNameDe(e.target.value)}
            required
            aria-invalid={invalidName}
            aria-describedby={invalidName ? "pf-error" : undefined}
            className={inputCls}
          />
        </Field>
        <Field label={t.add.desc} htmlFor="pf-desc-de">
          <textarea id="pf-desc-de" value={descDe} onChange={(e) => setDescDe(e.target.value)} rows={2} className={`${inputCls} h-auto py-2`} />
        </Field>
        <div>
          <span
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            aria-invalid={invalidImage}
            aria-describedby={invalidImage ? "pf-error" : undefined}
          >
            {t.add.photo} <span className="text-red-500">*</span>
          </span>
          <div className="grid grid-cols-2 gap-2">
            <label className="cursor-pointer inline-flex items-center justify-center gap-2 h-11 px-3 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 focus-within:ring-2 focus-within:ring-sky-500/60 transition-colors">
              <CameraIcon width={16} height={16} />
              {t.add.camera}
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />
            </label>
            <label className="cursor-pointer inline-flex items-center justify-center gap-2 h-11 px-3 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 focus-within:ring-2 focus-within:ring-sky-500/60 transition-colors">
              <ImageIcon width={16} height={16} />
              {t.add.gallery}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />
            </label>
          </div>
          {imageUrl && (
            <div className="relative w-full aspect-video mt-3 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt={t.add.previewAlt} className={`w-full h-full object-cover transition-opacity ${uploading ? "opacity-50" : ""}`} />
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2Icon width={32} height={32} className="animate-spin text-sky-700" />
                </div>
              )}
              {rotateSuccess && (
                <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-emerald-500 text-white text-xs font-medium">
                  {t.add2.rotateSuccess}
                </div>
              )}
              <div className="absolute top-2 right-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={handleRotate}
                  disabled={uploading}
                  className="cursor-pointer w-9 h-9 inline-flex items-center justify-center rounded-full bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 shadow-md hover:bg-white dark:hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 disabled:opacity-60"
                  aria-label={locale === "de" ? "Drehen" : "Döndür"}
                  style={{ transform: "scaleX(-1)" }}
                >
                  <RotateCcwIcon width={16} height={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="cursor-pointer w-9 h-9 inline-flex items-center justify-center rounded-full bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 shadow-md hover:bg-white dark:hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
                  aria-label={t.add.removePhoto}
                >
                  <XIcon width={16} height={16} />
                </button>
              </div>
            </div>
          )}
        </div>
        <Field label={t.add.category} htmlFor="pf-cat">
          <select id="pf-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {getName(c)}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.add.price} required htmlFor="pf-price">
            <input
              id="pf-price"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={price || ""}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              required
              aria-invalid={invalidPrice}
              aria-describedby={invalidPrice ? "pf-error" : undefined}
              className={`tabular ${inputCls}`}
            />
          </Field>
          <Field label={locale === "de" ? "VE" : "Paket"} htmlFor="pf-ve">
            <input
              id="pf-ve"
              type="number"
              min={0}
              step="1"
              inputMode="numeric"
              value={ve || ""}
              onChange={(e) => setVe(parseInt(e.target.value) || 0)}
              className={`tabular ${inputCls}`}
            />
          </Field>
        </div>
        <Field label={t.product.artNr} htmlFor="pf-sku">
          <input id="pf-sku" type="text" value={sku} onChange={(e) => setSku(e.target.value)} placeholder={t.add2.skuPlaceholder} className={inputCls} />
        </Field>
        <Field label={t.add2.dimensions} htmlFor="pf-dim">
          <select
            id="pf-dim"
            value={dimCustom ? "__custom__" : dim}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__custom__") { setDimCustom(true); setDim(""); }
              else { setDimCustom(false); setDim(v); }
            }}
            className={inputCls}
          >
            <option value="">—</option>
            {dimPresets.map((d) => <option key={d} value={d}>{d}</option>)}
            <option value="__custom__">{t.add2.dimCustom}</option>
          </select>
          {dimCustom && (
            <>
              <label htmlFor="pf-dim-custom" className="sr-only">{t.add2.dimensions}</label>
              <input
                id="pf-dim-custom"
                type="text"
                value={dim}
                onChange={(e) => setDim(e.target.value)}
                placeholder={t.add2.dimPlaceholder}
                className={`${inputCls} mt-2`}
                autoFocus
              />
            </>
          )}
        </Field>
      </form>
      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl flex justify-between items-center gap-2">
        {props.mode === "edit" && onDelete && initial ? (
          <button
            type="button"
            onClick={() => onDelete(initial)}
            disabled={isPending || uploading}
            aria-label={t.catalog.deleteProduct}
            className="cursor-pointer inline-flex items-center gap-1.5 h-10 px-3 rounded-lg text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 transition-colors disabled:opacity-60"
          >
            <Trash2Icon width={15} height={15} />
            <span className="hidden sm:inline">{t.catalog.deleteProduct}</span>
          </button>
        ) : (
          <span />
        )}
        <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="cursor-pointer h-10 px-4 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors disabled:opacity-60"
        >
          {t.common.cancel}
        </button>
        {next ? (
          <>
            <button
              type="submit"
              form="pf-form"
              disabled={isPending || uploading}
              className="cursor-pointer h-10 px-4 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors disabled:opacity-60"
            >
              {isPending && !saveAndNextPending ? t.common.loading : t.add.save}
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={isPending || uploading}
              className="cursor-pointer inline-flex items-center gap-1.5 h-10 px-5 rounded-lg text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors disabled:opacity-60"
            >
              {saveAndNextPending ? t.common.loading : (<>{t.add2.saveAndNext}<ChevronRightIcon width={14} height={14} /></>)}
            </button>
          </>
        ) : (
          <button
            type="submit"
            form="pf-form"
            disabled={isPending || uploading}
            className="cursor-pointer h-10 px-5 rounded-lg text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors disabled:opacity-60"
          >
            {isPending || uploading ? t.common.loading : t.add.save}
          </button>
        )}
        </div>
      </div>
    </Modal>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
