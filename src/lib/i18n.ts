import { Category, Locale, Product } from "./types";

type LocaleDict = {
  appName: string;
  nav: {
    catalog: string;
    orders: string;
    dashboard: string;
    customers: string;
    settings: string;
    stock: string;
    stockBadge: (n: number) => string;
    home: string;
    main: string;
    skip: string;
    tagline: string;
    browse: string;
  };
  catalog: {
    searchLabel: string;
    searchPlaceholder: string;
    addProduct: string;
    all: string;
    categoryFilter: string;
    empty: string;
    clearFilters: string;
    customBadge: string;
    deleteProduct: string;
    deleteConfirm: (n: string) => string;
    productDeleted: string;
    productAdded: string;
    detailAria: (n: string) => string;
    qtyMinus: (n: string) => string;
    qtyPlus: (n: string) => string;
    qty: (n: string) => string;
    cartCount: (n: number, kinds: number) => string;
    cartTotal: string;
    cartSubtotal: string;
    /** "MwSt 19%" — VAT line label. Pass the rate to render the percent. */
    cartTaxLine: (rate: number) => string;
    createOrder: string;
    cartLive: (n: number, t: string) => string;
    cartEmpty: string;
    cartView: string;
    cartTitle: string;
    cartHint: string;
    cartClose: string;
    backToTop: string;
    addCategory: string;
    editMode: string;
    editModeDone: string;
    editProduct: string;
    resetOverride: string;
    resetOverrideConfirm: string;
    productUpdated: string;
    hiddenBadge: string;
    restoreProduct: string;
    productRestored: string;
    deleteAriaCat: (n: string) => string;
    undo: string;
    title: string;
    subtitle: string;
    sortLabel: string;
    sortName: string;
    sortPriceAsc: string;
    sortPriceDesc: string;
    resultCount: (n: number) => string;
    addToCart: string;
    showMore: string;
    showLess: string;
  };
  addCategory: {
    title: string;
    nameLabel: string;
    nameHint: string;
    save: string;
    nameRequired: string;
    duplicate: string;
    added: string;
    deleteConfirm: (n: string) => string;
    deleted: string;
    /** "+ Yeni Kategori" — inline picker trigger inside ProductForm */
    quickAdd: string;
    /** Placeholder for the inline DE-only input */
    placeholder: string;
    /** Generic "Kategorie konnte nicht gespeichert werden" fallback */
    saveError: string;
  };
  add: {
    title: string;
    name: string;
    desc: string;
    photo: string;
    camera: string;
    gallery: string;
    removePhoto: string;
    previewAlt: string;
    category: string;
    price: string;
    save: string;
    validationErr: string;
    photoErr: string;
  };
  order: {
    title: string;
    modeLabel: string;
    existing: string;
    new: string;
    selectCustomer: string;
    authorizedName: string;
    shopName: string;
    summary: string;
    total: string;
    confirm: string;
    reqErr: string;
    pickErr: string;
    saved: string;
  };
  orders: {
    title: (n: number) => string;
    listTitle: string;
    searchPlaceholder: string;
    searchLabel: string;
    empty: string;
    emptyHint: string;
    goCatalog: string;
    noMatch: string;
    delete: string;
    deleteConfirm: (s: string) => string;
    deleted: string;
    exportPdf: string;
    columns: {
      shop: string;
      customer: string;
      items: string;
      total: string;
      date: string;
      actions: string;
    };
    itemsCount: (n: number) => string;
    view: string;
    backToList: string;
    notFound: string;
    detailTitle: string;
    lineUnit: string;
    lineQty: string;
    lineSubtotal: string;
  };
  product: { artNr: string; pack: (n: number) => string; required: string; dimensions: string };
  browse: {
    page: (cur: number, total: number) => string;
    back: string;
    next: string;
    noProducts: string;
    addingSoon: string;
  };
  add2: {
    dimensions: string;
    dimCustom: string;
    dimPlaceholder: string;
    skuPlaceholder: string;
    rotateSuccess: string;
    saveAndNext: string;
    prevItem: (name: string) => string;
    nextItem: (name: string) => string;
    itemPosition: (cur: number, total: number) => string;
    discardChanges: string;
  };
  common: { close: string; cancel: string; confirm: string; save: string; delete: string; loading: string };
  dashboard: {
    title: string;
    welcome: string;
    welcomeBack: (name: string) => string;
    statOrders: string;
    statRevenue: string;
    statProducts: string;
    statCustomers: string;
    recentOrders: string;
    viewAll: string;
    quickActions: string;
    actionNewOrder: string;
    actionNewOrderDesc: string;
    actionAddProduct: string;
    actionAddProductDesc: string;
    actionAddCustomer: string;
    actionAddCustomerDesc: string;
    emptyOrders: string;
    monthRevenue: string;
  };
  customers: {
    title: string;
    subtitle: string;
    empty: string;
    emptyHint: string;
    columns: { name: string; shop: string; orders: string; lastOrder: string };
    never: string;
    new: string;
  };
  settings: {
    title: string;
    subtitle: string;
    tabs: { categories: string; products: string; data: string; display: string };
    categoriesHeading: string;
    customCategoriesEmpty: string;
    seedCategories: string;
    productsHeading: string;
    customProductsEmpty: string;
    overridesHeading: string;
    dataHeading: string;
    storageUsage: string;
    exportData: string;
    exportDesc: string;
    clearData: string;
    clearDesc: string;
    clearConfirm: string;
    cleared: string;
    display: {
      heading: string;
      hint: string;
      name: string;
      description: string;
      sku: string;
      dimensions: string;
      price: string;
      packagingUnit: string;
      alwaysOn: string;
      crossDeviceHint: string;
      refreshHint: string;
      saveError: string;
      catalogSection: string;
      catalogHint: string;
      browseSection: string;
      browseHint: string;
    };
  };
  confirm: {
    title: string;
    cancel: string;
    confirm: string;
  };
  stock: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    allCategories: string;
    sortLowFirst: string;
    sortAZ: string;
    noProducts: string;
    saving: string;
    saved: string;
    saveFailed: string;
    retry: string;
    negativeWarning: string;
    decrement: (n: string) => string;
    increment: (n: string) => string;
    valueLabel: (n: string) => string;
    undo: string;
    undone: string;
    invalidValue: string;
    lowStockHint: (n: number) => string;
    unit: string;
    productCount: (n: number) => string;
  };
  pin: {
    unlockTitleSettings: string;
    unlockTitleStock: string;
    unlockTitleOrders: string;
    unlockSubtitle: string;
    setupTitle: string;
    setupSubtitle: string;
    enterCurrent: string;
    enterNew: string;
    enterConfirm: string;
    incorrect: string;
    mismatch: string;
    tooManyAttempts: string;
    saved: string;
    saveError: string;
    verifying: string;
    saving: string;
    cancel: string;
    backspace: string;
    digit: (n: number) => string;
    dotsProgress: (filled: number, total: number) => string;
    changeSection: string;
    changeDesc: string;
    changeButton: string;
    loadError: string;
    retry: string;
    back: string;
  };
};

export const dict: Record<Locale, LocaleDict> = {
  de: {
    appName: "Souvenirs Berlin",
    nav: {
      catalog: "Katalog",
      orders: "Bestellungen",
      dashboard: "Übersicht",
      customers: "Kunden",
      settings: "Einstellungen",
      stock: "Lager",
      stockBadge: (n: number) => `${n} Produkt(e) mit niedrigem Bestand`,
      home: "Startseite",
      main: "Hauptnavigation",
      skip: "Zum Inhalt springen",
      tagline: "Großhandel",
      browse: "Vitrine",
    },
    catalog: {
      title: "Katalog",
      subtitle: "Produkte suchen, in den Warenkorb legen und Bestellung erstellen.",
      searchLabel: "Produkt suchen",
      searchPlaceholder: "Produktname oder Code suchen…",
      addProduct: "Produkt hinzufügen",
      all: "Alle",
      categoryFilter: "Kategoriefilter",
      empty: "Keine Produkte zu Ihrer Suche gefunden.",
      clearFilters: "Filter zurücksetzen",
      customBadge: "Eigen",
      deleteProduct: "Produkt löschen",
      deleteConfirm: (n: string) => `Möchten Sie "${n}" wirklich löschen?`,
      productDeleted: "Produkt gelöscht",
      productAdded: "Produkt hinzugefügt",
      detailAria: (n: string) => `Details zu ${n} ansehen`,
      qtyMinus: (n: string) => `Stück von ${n} verringern`,
      qtyPlus: (n: string) => `Stück von ${n} erhöhen`,
      qty: (n: string) => `Stück von ${n}`,
      cartCount: (n: number, kinds: number) => `${n} Artikel (${kinds} Sorten)`,
      cartTotal: "Gesamt",
      cartSubtotal: "Zwischensumme (netto)",
      cartTaxLine: (rate: number) => `MwSt ${rate}%`,
      createOrder: "Bestellung erstellen",
      cartLive: (n: number, t: string) => `${n} Artikel im Warenkorb, gesamt ${t}`,
      cartEmpty: "Warenkorb ist leer",
      cartView: "Warenkorb anzeigen",
      cartTitle: "Ausgewählte Artikel",
      cartHint: "Stückzahlen können hier auch angepasst werden",
      cartClose: "Warenkorb schließen",
      backToTop: "Nach oben",
      addCategory: "Kategorie hinzufügen",
      editMode: "Bearbeiten",
      editModeDone: "Fertig",
      editProduct: "Produkt bearbeiten",
      resetOverride: "Zurücksetzen",
      resetOverrideConfirm: "Möchten Sie die Änderungen an diesem Produkt wirklich zurücksetzen?",
      productUpdated: "Produkt aktualisiert",
      hiddenBadge: "Ausgeblendet",
      restoreProduct: "Wiederherstellen",
      productRestored: "Produkt wiederhergestellt",
      deleteAriaCat: (n) => `Kategorie ${n} löschen`,
      undo: "Rückgängig",
      sortLabel: "Sortieren",
      sortName: "Name",
      sortPriceAsc: "Preis ↑",
      sortPriceDesc: "Preis ↓",
      resultCount: (n: number) => `${n} Produkte`,
      addToCart: "In den Warenkorb",
      showMore: "Mehr",
      showLess: "Weniger",
    },
    addCategory: {
      title: "Neue Kategorie",
      nameLabel: "Kategoriename",
      nameHint: "Dieser Name wird für Türkisch und Deutsch verwendet",
      save: "Kategorie speichern",
      nameRequired: "Kategoriename erforderlich",
      duplicate: "Eine Kategorie mit diesem Namen existiert bereits",
      added: "Kategorie hinzugefügt",
      deleteConfirm: (n: string) =>
        `Möchten Sie die Kategorie "${n}" wirklich löschen? Eigene Produkte in dieser Kategorie verlieren ihre Zuordnung.`,
      deleted: "Kategorie gelöscht",
      quickAdd: "Neue Kategorie",
      placeholder: "Kategoriename",
      saveError: "Kategorie konnte nicht gespeichert werden",
    },
    add: {
      title: "Neues Produkt",
      name: "Produktname",
      desc: "Beschreibung",
      photo: "Foto",
      camera: "Foto aufnehmen",
      gallery: "Aus Galerie wählen",
      removePhoto: "Foto entfernen",
      previewAlt: "Vorschau des hochgeladenen Fotos",
      category: "Kategorie",
      price: "Preis (€)",
      save: "Speichern",
      validationErr: "Bitte füllen Sie alle Felder aus (Preis muss größer 0 sein)",
      photoErr: "Foto konnte nicht geladen werden",
    },
    order: {
      title: "Bestellung erstellen",
      modeLabel: "Kundentyp",
      existing: "Bestehender Kunde",
      new: "Neuer Kunde",
      selectCustomer: "Kunde auswählen",
      authorizedName: "Ansprechpartner",
      shopName: "Shop-Name",
      summary: "Bestellübersicht",
      total: "Gesamt",
      confirm: "Bestellung bestätigen",
      reqErr: "Ansprechpartner und Shop-Name erforderlich",
      pickErr: "Bitte einen Kunden auswählen",
      saved: "Bestellung gespeichert",
    },
    orders: {
      title: (n: number) => `Bestellungen (${n})`,
      listTitle: "Bestellungen",
      searchPlaceholder: "Kunde oder Shop suchen…",
      searchLabel: "Bestellung suchen",
      empty: "Noch keine Bestellungen",
      emptyHint: "Wählen Sie Produkte aus dem Katalog und erstellen Sie Ihre erste Bestellung.",
      goCatalog: "Zum Katalog",
      noMatch: "Keine Bestellungen zu Ihrer Suche gefunden.",
      delete: "Bestellung löschen",
      deleteConfirm: (s: string) => `Möchten Sie die Bestellung von ${s} wirklich löschen?`,
      deleted: "Bestellung gelöscht",
      exportPdf: "PDF",
      columns: {
        shop: "Shop",
        customer: "Kunde",
        items: "Artikel",
        total: "Gesamt",
        date: "Datum",
        actions: "Aktionen",
      },
      itemsCount: (n: number) => `${n} Artikel`,
      view: "Ansehen",
      backToList: "← Alle Bestellungen",
      notFound: "Bestellung nicht gefunden",
      detailTitle: "Bestelldetails",
      lineUnit: "Einzelpreis",
      lineQty: "Stück",
      lineSubtotal: "Zwischensumme",
    },
    product: {
      artNr: "Art.-Nr.",
      pack: (n: number) => `VE ${n} Stück`,
      required: "*",
      dimensions: "Maße",
    },
    browse: {
      page: (c: number, t: number) => `Seite ${c} / ${t}`,
      back: "Zurück",
      next: "Weiter",
      noProducts: "Noch keine Produkte",
      addingSoon: "Produkte werden bald hinzugefügt",
    },
    add2: {
      dimensions: "Maße",
      dimCustom: "Eigene Eingabe…",
      dimPlaceholder: "z.B. 85 mm x 55 mm",
      skuPlaceholder: "z.B. 130022",
      rotateSuccess: "✓ Gedreht",
      saveAndNext: "Speichern & Weiter",
      prevItem: (name) => `Vorheriges: ${name}`,
      nextItem: (name) => `Nächstes: ${name}`,
      itemPosition: (cur, total) => `${cur} / ${total}`,
      discardChanges: "Änderungen nicht gespeichert. Trotzdem wechseln?",
    },
    common: { close: "Schließen", cancel: "Abbrechen", confirm: "Bestätigen", save: "Speichern", delete: "Löschen", loading: "Lädt…" },
    dashboard: {
      title: "Übersicht",
      welcome: "Willkommen",
      welcomeBack: (name: string) => `Willkommen zurück, ${name}`,
      statOrders: "Bestellungen",
      statRevenue: "Gesamtumsatz",
      statProducts: "Produkte",
      statCustomers: "Kunden",
      recentOrders: "Letzte Bestellungen",
      viewAll: "Alle ansehen",
      quickActions: "Schnellaktionen",
      actionNewOrder: "Bestellung erstellen",
      actionNewOrderDesc: "Produkte aus dem Katalog auswählen und Bestellung vorbereiten",
      actionAddProduct: "Produkt hinzufügen",
      actionAddProductDesc: "Neues Produkt oder Kategorie anlegen",
      actionAddCustomer: "Kunde hinzufügen",
      actionAddCustomerDesc: "Neuen Shop oder Ansprechpartner speichern",
      emptyOrders: "Noch keine Bestellungen",
      monthRevenue: "Diesen Monat",
    },
    customers: {
      title: "Kunden",
      subtitle: "Gespeicherte Shops und Ansprechpartner.",
      empty: "Noch keine Kunden",
      emptyHint: "Beim Erstellen der ersten Bestellung wird ein Kunde hinzugefügt.",
      columns: { name: "Ansprechpartner", shop: "Shop", orders: "Bestellungen", lastOrder: "Letzte Bestellung" },
      never: "—",
      new: "Neuer Kunde",
    },
    settings: {
      title: "Einstellungen",
      subtitle: "Kategorien, Produkte und Daten verwalten.",
      tabs: { categories: "Kategorien", products: "Produkte", data: "Daten", display: "Anzeige" },
      categoriesHeading: "Eigene Kategorien",
      customCategoriesEmpty: "Noch keine eigenen Kategorien.",
      seedCategories: "Standard-Kategorien",
      productsHeading: "Eigene Produkte",
      customProductsEmpty: "Noch keine eigenen Produkte.",
      overridesHeading: "Bearbeitete Produkte",
      dataHeading: "Datenverwaltung",
      storageUsage: "Speichernutzung",
      exportData: "Daten exportieren",
      exportDesc: "Alle Kunden-, Bestell- und Produktdaten als JSON herunterladen.",
      clearData: "Alle Daten löschen",
      clearDesc: "localStorage wird komplett geleert. Diese Aktion kann nicht rückgängig gemacht werden.",
      clearConfirm: "Alle Daten werden dauerhaft gelöscht. Sind Sie sicher?",
      cleared: "Alle Daten gelöscht",
      display: {
        heading: "Produktfelder",
        hint: "Felder ein-/ausblenden, die im Katalog und in der Vitrine angezeigt werden.",
        name: "Produktname",
        description: "Bezeichnung",
        sku: "Art.-Nr.",
        dimensions: "Maße",
        price: "Preis",
        packagingUnit: "VE",
        alwaysOn: "Immer sichtbar",
        crossDeviceHint: "Diese Einstellungen gelten auf allen Ihren Geräten und in geteilten Links.",
        refreshHint: "Bei bereits geöffneten Share-Links müssen Kunden die Seite neu laden, um die neue Einstellung zu sehen.",
        saveError: "Änderung nicht gespeichert, bitte erneut versuchen.",
        catalogSection: "Katalog",
        catalogHint: "Felder des Katalogs, den Sie beim Anlegen von Bestellungen sehen.",
        browseSection: "Vitrine",
        browseHint: "Felder der Vitrine und der öffentlichen Share-Links, die Kunden sehen.",
      },
    },
    confirm: {
      title: "Sind Sie sicher?",
      cancel: "Abbrechen",
      confirm: "Löschen",
    },
    stock: {
      title: "Lager",
      subtitle: "Ihren Produktbestand verwalten. Bei Bestellungen wird automatisch abgezogen.",
      searchPlaceholder: "Produkt suchen…",
      allCategories: "Alle Kategorien",
      sortLowFirst: "Niedriger Bestand zuerst",
      sortAZ: "A → Z",
      noProducts: "Keine Produkte gefunden, die zu Ihrer Suche passen.",
      saving: "Wird gespeichert…",
      saved: "Gespeichert",
      saveFailed: "Nicht gespeichert",
      retry: "Erneut versuchen",
      negativeWarning: "Verkäufe übersteigen den Bestand",
      decrement: (n: string) => `Bestand von ${n} verringern`,
      increment: (n: string) => `Bestand von ${n} erhöhen`,
      valueLabel: (n: string) => `Bestandsmenge für ${n}`,
      undo: "Rückgängig",
      undone: "Rückgängig gemacht",
      invalidValue: "Ungültiger Wert",
      lowStockHint: (n: number) => `${n} Produkt(e) mit niedrigem Bestand (≤5)`,
      unit: "Stk.",
      productCount: (n: number) => `${n} Produkte`,
    },
    pin: {
      unlockTitleSettings: "PIN erforderlich",
      unlockTitleStock: "PIN erforderlich",
      unlockTitleOrders: "PIN erforderlich",
      unlockSubtitle: "Bitte Ihre 6-stellige PIN eingeben.",
      setupTitle: "PIN einrichten",
      setupSubtitle: "Legen Sie eine 6-stellige PIN fest, um Einstellungen und Lager zu schützen.",
      enterCurrent: "Aktuelle PIN",
      enterNew: "Neue PIN",
      enterConfirm: "Neue PIN bestätigen",
      incorrect: "Falsche PIN",
      mismatch: "PINs stimmen nicht überein",
      tooManyAttempts: "Zu viele Versuche. Bitte warten.",
      saved: "PIN gespeichert",
      saveError: "Nicht gespeichert",
      verifying: "Wird überprüft…",
      saving: "Wird gespeichert…",
      cancel: "Abbrechen",
      backspace: "Löschen",
      digit: (n: number) => `Ziffer ${n}`,
      dotsProgress: (filled: number, total: number) => `${filled} von ${total} Ziffern eingegeben`,
      changeSection: "PIN ändern",
      changeDesc: "Aktualisieren Sie die PIN, mit der Einstellungen und Lager entsperrt werden.",
      changeButton: "PIN ändern",
      loadError: "PIN-Status konnte nicht geladen werden.",
      retry: "Erneut versuchen",
      back: "Zurück",
    },
  },
};

export type Dict = LocaleDict;

// Locale param kept for callsite compatibility; always "de".
export function getCategoryName(c: Category, _locale?: Locale): string {
  return c.nameDe;
}

export function getProductName(p: Product, cat: Category | undefined, _locale?: Locale): string {
  if (p.customName) return p.customName;
  const catName = cat ? getCategoryName(cat) : "";
  return `${catName} ${p.id}`.trim();
}

export function getProductDescription(p: Product, _locale?: Locale): string {
  if (p.customDescription) return p.customDescription;
  const t = dict.de.product;
  const parts = [`${t.artNr} ${p.id}`];
  if (p.dim) parts.push(p.dim);
  if (p.ve) parts.push(t.pack(p.ve));
  return parts.join(" — ");
}

export function formatPrice(value: number, _locale?: Locale): string {
  const num = value.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${num} €`;
}

export function formatDateTime(iso: string, _locale?: Locale): string {
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string, _locale?: Locale): string {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
