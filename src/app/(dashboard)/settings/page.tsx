"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useI18n } from "@/components/I18nProvider";
import { formatPrice } from "@/lib/i18n";
import { useToast } from "@/components/Toast";
import PageHeader from "@/components/PageHeader";
import ConfirmDialog from "@/components/ConfirmDialog";
import ProductForm from "@/components/ProductForm";
import AddCategoryDialog from "@/components/AddCategoryDialog";
import AddCustomerDialog from "@/components/AddCustomerDialog";
import ToggleSwitch from "@/components/ToggleSwitch";
import { useDisplayFields, type DisplayFields } from "@/components/DisplayFieldsProvider";
import { PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from "@/components/icons";
import PinGate from "@/components/PinGate";
import PinChangeDialog from "@/components/PinChangeDialog";
import IdleLock, { ADMIN_IDLE_LOCK_MS } from "@/components/IdleLock";
import {
  fetchCategories,
  fetchProducts,
  deleteCategory,
  deleteProduct,
  type SettingsCategory,
  type SettingsProduct,
} from "@/app/(dashboard)/catalog/actions";
import {
  lockPin,
  hasPin as hasPinAction,
  removePin as removePinAction,
  fetchCustomersForSettings,
  type SettingsCustomer,
} from "@/app/(dashboard)/settings/actions";
import PinPad from "@/components/PinPad";
import Modal from "@/components/Modal";

type Tab = "categories" | "products" | "customers" | "data" | "display";

// Per-page unlock key. Each admin page has its own key — see StockClient
// for rationale (prevents cross-page leak when the tablet is handed over).
const UNLOCK_KEY = "souvenir_admin_unlocked_settings";

export default function SettingsPage() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("categories");
  const [unlocked, setUnlocked] = useState(false);
  const [showPinChange, setShowPinChange] = useState(false);
  const [showStockPinChange, setShowStockPinChange] = useState(false);
  const [showStockPinRemove, setShowStockPinRemove] = useState(false);
  // Whether the optional Lager-PIN is currently set. Drives the
  // Einrichten/Ändern/Entfernen button labels in the Daten tab.
  const [stockPinExists, setStockPinExists] = useState<boolean | null>(null);
  const [removePinPending, setRemovePinPending] = useState(false);
  const [removePinError, setRemovePinError] = useState<string | null>(null);
  const [removePinErrorKey, setRemovePinErrorKey] = useState(0);
  const [removePinResetKey, setRemovePinResetKey] = useState(0);

  const refreshStockPinStatus = useCallback(() => {
    hasPinAction("stock").then((res) => {
      if (res.exists !== undefined) setStockPinExists(!!res.exists);
    });
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    refreshStockPinStatus();
  }, [unlocked, refreshStockPinStatus]);
  useEffect(() => {
    // Server state is the source of truth. sessionStorage is intentionally
    // NOT consulted on mount — it would let a stale client flag bypass the
    // pinpad after a server-side reset (deploy, schema migration, idle
    // lockPin from another tab). PinGate's own getPinStatus call decides
    // whether to render setupNew vs unlock; we keep `unlocked` local to
    // this layout and flip it via onUnlocked only.
    return () => {
      try { sessionStorage.removeItem(UNLOCK_KEY); } catch {}
      // Lock on navigation away — don't leave /settings unlocked when the
      // owner hands the tablet to a customer.
      void lockPin("settings");
    };
  }, []);

  const [categories, setCategories] = useState<SettingsCategory[]>([]);
  const [products, setProducts] = useState<SettingsProduct[]>([]);
  const [customers, setCustomers] = useState<SettingsCustomer[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [showAddCat, setShowAddCat] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddProd, setShowAddProd] = useState(false);
  const [editProd, setEditProd] = useState<SettingsProduct | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; onYes: () => void } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [prodSearch, setProdSearch] = useState("");
  const [prodCatFilter, setProdCatFilter] = useState<string>("all");

  function reload() {
    Promise.all([fetchCategories(), fetchProducts(), fetchCustomersForSettings()]).then(
      ([catRes, prodRes, custRes]) => {
        if (catRes.data) setCategories(catRes.data);
        if (prodRes.data) setProducts(prodRes.data);
        if (custRes.data) setCustomers(custRes.data);
        setLoaded(true);
      }
    );
  }

  useEffect(() => {
    if (unlocked) reload();
  }, [unlocked]);

  const getName = useCallback((item: { name_de: string }): string => item.name_de, []);

  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c] as const)),
    [categories]
  );

  const existingDimensions = useMemo(() =>
    [...new Set(products.map((p) => p.dimensions).filter((d): d is string => !!d))],
    [products]
  );

  const filteredProducts = useMemo(() => {
    let list = products;
    if (prodCatFilter !== "all") {
      list = list.filter((p) => p.category_id === prodCatFilter);
    }
    const q = prodSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => p.name_de.toLowerCase().includes(q));
    }
    return list;
  }, [products, prodCatFilter, prodSearch]);

  function handleDeleteCategory(c: SettingsCategory) {
    setConfirm({
      message: t.addCategory.deleteConfirm(getName(c)),
      onYes: () => {
        startTransition(async () => {
          const result = await deleteCategory(c.id);
          if (result.error) {
            toast.show(result.error);
            setConfirm(null);
            return;
          }
          reload();
          toast.show(t.addCategory.deleted);
          setConfirm(null);
        });
      },
    });
  }


  function handleExport() {
    const payload = {
      exportedAt: new Date().toISOString(),
      categories,
      products,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `souvenir-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!unlocked) {
    return (
      <div>
        <PageHeader title={t.settings.title} subtitle={t.settings.subtitle} />
        <PinGate
          unlockTitle={t.pin.unlockTitleSettings}
          sessionKey={UNLOCK_KEY}
          scope="settings"
          onUnlocked={() => setUnlocked(true)}
        />
      </div>
    );
  }

  if (!loaded) {
    return (
      <div>
        <PageHeader title={t.settings.title} subtitle={t.settings.subtitle} />
        <div className="h-96 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      <IdleLock
        timeoutMs={ADMIN_IDLE_LOCK_MS}
        onExpire={() => {
          try { sessionStorage.removeItem(UNLOCK_KEY); } catch {}
          void lockPin("settings");
          setUnlocked(false);
        }}
      />
      <PageHeader title={t.settings.title} subtitle={t.settings.subtitle} />

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl mb-6 max-w-md">
        {(["categories", "products", "customers", "data", "display"] as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            aria-pressed={tab === k}
            className={`cursor-pointer flex-1 h-9 px-3 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
              tab === k
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            {t.settings.tabs[k]}
          </button>
        ))}
      </div>

      {/* CATEGORIES */}
      {tab === "categories" && (
        <div className="space-y-6">
          <Section
            title={`${t.settings.categoriesHeading} (${categories.length})`}
            action={
              <button
                type="button"
                onClick={() => setShowAddCat(true)}
                className="cursor-pointer inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
              >
                <PlusIcon width={14} height={14} />
                {t.catalog.addCategory}
              </button>
            }
          >
            {categories.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                {t.settings.customCategoriesEmpty}
              </p>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {categories.map((c) => (
                  <li key={c.id} className="flex items-center justify-between px-5 py-3">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-50">
                        {c.name_de}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDeleteCategory(c)}
                      aria-label={t.catalog.deleteAriaCat(getName(c))}
                      className="cursor-pointer w-9 h-9 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-60"
                    >
                      <Trash2Icon width={15} height={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}

      {/* PRODUCTS */}
      {tab === "products" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
            {/* Search + Filter + Add bar */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <SearchIcon
                    width={18}
                    height={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <input
                    type="search"
                    placeholder={t.catalog.searchPlaceholder}
                    value={prodSearch}
                    onChange={(e) => setProdSearch(e.target.value)}
                    className="w-full h-10 pl-10 pr-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddProd(true)}
                  className="cursor-pointer inline-flex items-center gap-1.5 h-10 px-4 rounded-lg text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors flex-shrink-0"
                >
                  <PlusIcon width={14} height={14} />
                  {t.catalog.addProduct}
                </button>
              </div>
              {/* Category filter chips */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setProdCatFilter("all")}
                  className={`cursor-pointer h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                    prodCatFilter === "all"
                      ? "bg-sky-700 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {t.catalog.all} ({products.length})
                </button>
                {categories.map((c) => {
                  const count = products.filter((p) => p.category_id === c.id).length;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setProdCatFilter(c.id)}
                      className={`cursor-pointer h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                        prodCatFilter === c.id
                          ? "bg-sky-700 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {getName(c)} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Product count */}
            <div className="px-5 py-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
              {filteredProducts.length} {locale === "de" ? "Produkte" : "ürün"}
            </div>

            {/* Product grid */}
            {filteredProducts.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                {t.catalog.empty}
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
                {filteredProducts.map((p) => {
                  const cat = p.category_id ? catById.get(p.category_id) : undefined;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setEditProd(p)}
                      className="cursor-pointer group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-md transition-all text-left overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
                    >
                      <div className="relative aspect-square bg-slate-100 dark:bg-slate-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.image_url || ""}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-contain p-2"
                        />
                        <div className="absolute inset-0 bg-sky-700/0 group-hover:bg-sky-700/10 transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-400 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm">
                            <PencilIcon width={12} height={12} className="inline mr-1" />
                            {t.catalog.editProduct}
                          </span>
                        </div>
                        {cat && (
                          <span className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-white/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 rounded">
                            {getName(cat)}
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="font-medium text-sm text-slate-900 dark:text-slate-50 truncate">{p.name_de}</div>
                        {p.description_de && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{p.description_de}</div>
                        )}
                        {p.dimensions && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{t.product.dimensions}: {p.dimensions}</div>
                        )}
                        {p.sku && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{t.product.artNr} {p.sku}</div>
                        )}
                        <div className="tabular text-sm font-semibold text-sky-700 dark:text-sky-400 mt-1">
                          {formatPrice(p.price)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* CUSTOMERS */}
      {tab === "customers" && (
        <div className="space-y-6">
          <Section
            title={`${t.settings.customersHeading} (${customers.length})`}
            action={
              <button
                type="button"
                onClick={() => setShowAddCustomer(true)}
                className="cursor-pointer inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors"
              >
                <PlusIcon width={14} height={14} />
                {t.customers.new}
              </button>
            }
          >
            {customers.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                {t.settings.customersEmpty}
              </p>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {customers.map((c) => {
                  const contact = [c.first_name, c.last_name].filter(Boolean).join(" ");
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-4 px-5 py-3">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-50 truncate">
                        {c.shop_name}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 truncate flex-shrink-0">
                        {contact}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>
      )}

      {/* DATA */}
      {tab === "data" && (
        <div className="space-y-6">
          <Section title={t.settings.dataHeading}>
            <div className="px-5 py-5 space-y-5">
              {/* Export */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    {t.settings.exportData}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.settings.exportDesc}</p>
                </div>
                <button
                  type="button"
                  onClick={handleExport}
                  className="cursor-pointer flex-shrink-0 h-9 px-4 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  {t.settings.exportData}
                </button>
              </div>

              {/* Change admin PIN */}
              <div className="flex items-start justify-between gap-4 pt-5 border-t border-slate-200 dark:border-slate-800">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    {t.pin.changeSection}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {t.pin.changeDesc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPinChange(true)}
                  className="cursor-pointer flex-shrink-0 h-9 px-4 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  {t.pin.changeButton}
                </button>
              </div>

              {/* Lager-PIN — optional override that gates /stock independently. */}
              <div className="flex items-start justify-between gap-4 pt-5 border-t border-slate-200 dark:border-slate-800">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {t.pin.stockSectionLabel}
                    </div>
                    {stockPinExists === false && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {t.pin.stockOptional}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {t.pin.stockHint}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {stockPinExists && (
                    <button
                      type="button"
                      onClick={() => setShowStockPinRemove(true)}
                      className="cursor-pointer h-9 px-3 rounded-lg text-xs font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      {t.pin.stockRemoveButton}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowStockPinChange(true)}
                    disabled={stockPinExists === null}
                    className="cursor-pointer h-9 px-4 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {stockPinExists ? t.pin.stockChangeButton : t.pin.stockSetupButton}
                  </button>
                </div>
              </div>

              {/* Cache reset — fallback for the rare case where the service
                  worker is stuck serving a stale bundle and the automatic
                  update-on-focus didn't kick in. */}
              <div className="flex items-start justify-between gap-4 pt-5 border-t border-slate-200 dark:border-slate-800">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    {locale === "de" ? "Cache zurücksetzen" : "Önbelleği temizle"}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {locale === "de"
                      ? "Service Worker + Cache löschen und App neu laden. Nur verwenden, wenn eine neue Version nicht automatisch geladen wurde."
                      : "Service worker + cache silinir, uygulama yeniden yüklenir. Sadece yeni sürüm otomatik yüklenmediyse kullan."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if ("serviceWorker" in navigator) {
                        const regs = await navigator.serviceWorker.getRegistrations();
                        await Promise.all(regs.map((r) => r.unregister()));
                      }
                      if ("caches" in window) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map((k) => caches.delete(k)));
                      }
                    } finally {
                      window.location.reload();
                    }
                  }}
                  className="cursor-pointer flex-shrink-0 h-9 px-4 rounded-lg text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors"
                >
                  {locale === "de" ? "Zurücksetzen" : "Sıfırla"}
                </button>
              </div>

            </div>
          </Section>
        </div>
      )}

      {/* DISPLAY / ANZEIGE */}
      {tab === "display" && <DisplayTab />}

      {/* Dialogs */}
      {showAddCat && (
        <AddCategoryDialog
          onClose={() => setShowAddCat(false)}
          onSaved={() => {
            reload();
            toast.show(t.addCategory.added);
            setShowAddCat(false);
          }}
        />
      )}
      {showAddCustomer && (
        <AddCustomerDialog
          onClose={() => setShowAddCustomer(false)}
          onSaved={() => {
            reload();
            toast.show(t.addCustomer.added);
            setShowAddCustomer(false);
          }}
        />
      )}
      {showAddProd && (
        <ProductForm
          mode="add"
          categories={categories}
          existingDimensions={existingDimensions}
          onClose={() => setShowAddProd(false)}
          onSaved={() => {
            reload();
            toast.show(t.catalog.productAdded);
            setShowAddProd(false);
          }}
        />
      )}
      {editProd && (() => {
        const editIdx = filteredProducts.findIndex((p) => p.id === editProd.id);
        const inList = editIdx !== -1;
        const prev = inList && editIdx > 0 ? filteredProducts[editIdx - 1] : null;
        const next = inList && editIdx < filteredProducts.length - 1 ? filteredProducts[editIdx + 1] : null;
        const position = inList
          ? { current: editIdx + 1, total: filteredProducts.length }
          : undefined;
        return (
          <ProductForm
            key={editProd.id}
            mode="edit"
            initial={editProd}
            categories={categories}
            existingDimensions={existingDimensions}
            prev={prev}
            next={next}
            position={position}
            onNavigate={(target, dirty) => {
              if (dirty) {
                setConfirm({
                  message: t.add2.discardChanges,
                  onYes: () => {
                    setEditProd(target);
                    setConfirm(null);
                  },
                });
              } else {
                setEditProd(target);
              }
            }}
            onClose={() => setEditProd(null)}
            onSaved={(nextTarget) => {
              reload();
              toast.show(t.catalog.productUpdated);
              setEditProd(nextTarget ?? null);
            }}
            onDelete={(p) => {
              setConfirm({
                message: t.catalog.deleteConfirm(getName(p)),
                onYes: () => {
                  startTransition(async () => {
                    const result = await deleteProduct(p.id);
                    if (result.error) {
                      toast.show(result.error);
                      setConfirm(null);
                      return;
                    }
                    setEditProd(null);
                    reload();
                    toast.show(t.catalog.productDeleted);
                    setConfirm(null);
                  });
                },
              });
            }}
          />
        );
      })()}
      {confirm && (
        <ConfirmDialog
          open={true}
          message={confirm.message}
          onConfirm={confirm.onYes}
          onCancel={() => setConfirm(null)}
        />
      )}
      {showPinChange && (
        <PinChangeDialog
          onClose={() => setShowPinChange(false)}
          onSaved={() => {
            setShowPinChange(false);
            toast.show(t.pin.saved);
          }}
        />
      )}
      {showStockPinChange && (
        <PinChangeDialog
          scope="stock"
          onClose={() => setShowStockPinChange(false)}
          onSaved={() => {
            setShowStockPinChange(false);
            toast.show(t.pin.saved);
            refreshStockPinStatus();
          }}
        />
      )}
      {showStockPinRemove && (
        <Modal
          title={t.pin.stockRemoveTitle}
          onClose={() => {
            setShowStockPinRemove(false);
            setRemovePinError(null);
          }}
        >
          <div className="px-6 py-6">
            <p className="text-sm text-slate-700 dark:text-slate-300 text-center mb-4">
              {t.pin.stockRemoveConfirm}
            </p>
            {removePinError && (
              <div
                role="alert"
                className="mb-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm border border-red-200 dark:border-red-900 text-center"
              >
                {removePinError}
              </div>
            )}
            <PinPad
              label={t.pin.enterAdminToRemove}
              onComplete={async (adminPin) => {
                setRemovePinPending(true);
                const result = await removePinAction(adminPin, "stock");
                setRemovePinPending(false);
                if (result.error) {
                  const msg =
                    result.error === "wrong_pin"
                      ? t.pin.incorrect
                      : result.error === "rate_limited"
                        ? t.pin.tooManyAttempts
                        : t.pin.saveError;
                  setRemovePinError(msg);
                  setRemovePinErrorKey((k) => k + 1);
                  setRemovePinResetKey((k) => k + 1);
                  return;
                }
                setShowStockPinRemove(false);
                setRemovePinError(null);
                toast.show(t.pin.stockRemoved);
                refreshStockPinStatus();
              }}
              disabled={removePinPending}
              errorKey={removePinErrorKey}
              resetKey={removePinResetKey}
            />
            {removePinPending && (
              <p className="mt-4 text-xs text-center text-slate-500 dark:text-slate-400">
                {t.pin.saving}
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

const DISPLAY_FIELD_KEYS: { key: keyof DisplayFields; locked?: boolean }[] = [
  { key: "name" },
  { key: "price" },
  { key: "packagingUnit" },
  { key: "sku" },
  { key: "dimensions" },
  { key: "description" },
];

function DisplayTab() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 px-5 py-3 text-xs text-sky-900 dark:text-sky-200">
        {t.settings.display.crossDeviceHint}
      </div>
      <DisplayScopeSection
        scope="catalog"
        heading={t.settings.display.catalogSection}
        hint={t.settings.display.catalogHint}
      />
      <DisplayScopeSection
        scope="browse"
        heading={t.settings.display.browseSection}
        hint={t.settings.display.browseHint}
        footer={t.settings.display.refreshHint}
      />
    </div>
  );
}

function DisplayScopeSection({
  scope,
  heading,
  hint,
  footer,
}: {
  scope: "catalog" | "browse";
  heading: string;
  hint: string;
  footer?: string;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const { fields, setField } = useDisplayFields(scope);
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          {heading}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>
      </div>
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {DISPLAY_FIELD_KEYS.map(({ key, locked }) => (
          <li key={key} className="flex items-center justify-between px-5 py-3.5">
            <div className="min-w-0">
              <span className="text-sm font-medium text-slate-900 dark:text-slate-50">
                {t.settings.display[key]}
              </span>
              {locked && (
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-1.5 py-0.5 rounded">
                  {t.settings.display.alwaysOn}
                </span>
              )}
            </div>
            <ToggleSwitch
              on={fields[key]}
              onChange={async (v) => {
                const result = await setField(key, v);
                if (result.error) toast.show(t.settings.display.saveError);
              }}
              disabled={!!locked}
              label={t.settings.display[key]}
            />
          </li>
        ))}
      </ul>
      {footer && (
        <p className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          {footer}
        </p>
      )}
    </div>
  );
}
