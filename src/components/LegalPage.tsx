// ============================================================================
// LegalPage — Allgemeine Geschäftsbedingungen (AGB)
// ============================================================================
// Renders as the final page of the public catalog flipbook (and admin Vitrine).
// Content is the AGB text exactly as in the printed City Kiosk catalog.
// Locale always German — legal text is not translated.
// ============================================================================

type Section = { id: string; title: string; body: string };

const SECTIONS: Section[] = [
  {
    id: "1",
    title: "§ 1 Geltungsbereich",
    body:
      "Für die Geschäftsbeziehung zwischen City Kiosk und dem Käufer gelten ausschließlich die nachfolgenden Allgemeinen Geschäftsbedingungen in ihrer zum Zeitpunkt der Bestellung gültigen Fassung. Abweichende Bedingungen des Käufers erkennt City Kiosk nicht an, es sei denn, City Kiosk hätte ausdrücklich schriftlich ihrer Geltung zugestimmt.",
  },
  {
    id: "3",
    title: "§ 3 Angebote",
    body:
      "Sämtliche Angebote und Preislisten sind freibleibend. Druckfehler und Irrtümer sowie Preisänderungen sind nicht ausgeschlossen. Kleine Abweichungen und technische Änderungen gegenüber unseren Abbildungen sind möglich.",
  },
  {
    id: "4",
    title: "§ 4 Rücknahme",
    body:
      "Wir gewähren für fehlerhafte, nicht benutzte Ware ein Rückgaberecht innerhalb von 10 Tagen. Die Rückgabe ist nur in vollständigen Verpackungseinheiten möglich. Eine Rückgabe aufgrund des Nichtgefallens der Farbe oder des Motivs des Artikels wird nicht gewährt. Im Falle einer Rückgabe von Artikeln müssen andere Artikel im gleichen Warenwert erworben werden. Eine Barauszahlung ist ausgeschlossen.",
  },
  {
    id: "5",
    title: "§ 5 Lieferung",
    body:
      "Lieferungen erfolgen zum frühstmöglichen Zeitpunkt. Der Versand erfolgt mit Post, Paketdienst oder Spedition. Zum Zeitpunkt der Übergabe an den Frachtführer geht die Gefahr des Verlustes, der Vernichtung und/oder der Beschädigung der Ware auf den Kunden über.",
  },
  {
    id: "6",
    title: "§ 6 Fälligkeit und Zahlung",
    body:
      "Die ausgewiesenen Preise sind Stückpreise zuzüglich der gesetzlichen Mehrwertsteuer in Höhe von z. Zt. 19 %, zahlbar innerhalb von 10 Tagen ab Rechnungsstellung. Wir behalten uns das Recht vor, Bestellungen nur gegen Vorkasse entgegenzunehmen. Bei Zahlungsverzug erfolgt die Verrechnung von EUR 5,- Mahnspesen pro Mahnung. Nach drei erfolglosen Mahnversuchen wird die Forderung zur gerichtlichen Eintreibung unserem Anwalt übergeben. Die dort anfallenden Kosten gehen zu Lasten des rückständigen Kunden. Sämtliche gelieferte Ware bleibt bis zur vollständigen Bezahlung unser unverpfändbares Eigentum und kommt ausdrücklich mit verlängertem Eigentumsvorbehalt zur Auslieferung.",
  },
  {
    id: "7",
    title: "§ 7 Gültigkeit",
    body: "Mit Vorliegen der jüngsten Preisliste verlieren alle vorangegangenen ihre Gültigkeit.",
  },
  {
    id: "8",
    title: "§ 8 Haftung",
    body:
      "Wir haften unbeschränkt für Schäden aufgrund Vorsatzes und grober Fahrlässigkeit. Wir haften ferner unbeschränkt für Schäden aufgrund der schuldhaften Verletzung von Leib, Leben oder Gesundheit sowie in allen Fällen von Verstößen gegen das Produkthaftungsgesetz. Für Fälle der einfachen Fahrlässigkeit übernehmen wir keine Haftung. Die Haftung für Folgeschäden ist, soweit gesetzlich zulässig, ausgeschlossen.",
  },
  {
    id: "9",
    title: "§ 9 Urheberrecht",
    body:
      "Bei Kundenaufträgen, bei denen der Kunde das Druckmotiv stellt, übernimmt der Auftraggeber die volle Verantwortung dafür, dass durch die Verwendung der von ihm vorgelegten Originale oder nach seinen Angaben hergestellten Vorlagen, Zeichnungen, Unterlagen nicht Rechte Dritter verletzt werden. Er stellt somit die Firma City Kiosk von allen etwaigen Regressansprüchen Dritter vollständig frei. Die von uns hergestellten Muster, Skizzen, Hilfsmittel, Entwürfe und Probedrucke bleiben unser Eigentum, insoweit dies nicht gesondert mit dem Auftraggeber vereinbart ist.",
  },
  {
    id: "10",
    title: "§ 10 Besonderes",
    body:
      "Einige unserer Artikel werden überwiegend aus Baumwolle hergestellt. Baumwolle ist ein Naturprodukt. Die unterschiedliche Beschaffenheit aufgrund natürlicher Umstände wirkt sich auf das Farbverhalten, das Flächengewicht, die Elastizität sowie das Waschverhalten aus. Diese Schwankungen in Färbung, Gewicht und weiteren Eigenschaften sind üblich und stellen daher keinen Reklamationsgrund dar.",
  },
  {
    id: "11",
    title: "§ 11 Salvatorische Klausel",
    body:
      "Sollten einzelne Bestimmungen dieser Allgemeinen Geschäftsbedingungen oder Teile davon unwirksam sein, so bleibt die Wirksamkeit der übrigen Bedingungen davon unberührt. Im Falle der Unwirksamkeit einzelner Bestimmungen gilt dasjenige als vereinbart, auf das sich die Parteien geeinigt hätten, hätten sie um die Unwirksamkeit gewusst.",
  },
  {
    id: "12",
    title: "§ 12 Anwendbares Recht",
    body:
      "Es gilt ausschließlich deutsches Recht. Für Streitigkeiten wird das zuständige Gericht der Stadt Berlin als Gerichtsstand und Erfüllungsort ausschließlich festgelegt.",
  },
];

export default function LegalPage() {
  return (
    <div className="h-full flex flex-col px-6 py-5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      <div className="flex-shrink-0 text-center pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-sky-700 dark:text-sky-400">
          City Kiosk
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50 mt-1">
          Allgemeine Geschäftsbedingungen
        </h2>
      </div>
      <div className="flex-1 min-h-0 columns-2 gap-5 text-[9.5px] leading-snug overflow-hidden">
        {SECTIONS.map((s) => (
          <section key={s.id} className="break-inside-avoid mb-2.5">
            <h3 className="font-semibold text-[10.5px] mb-0.5 text-slate-900 dark:text-slate-50">
              {s.title}
            </h3>
            <p className="text-justify hyphens-auto" style={{ hyphens: "auto" }}>
              {s.body}
            </p>
          </section>
        ))}
      </div>
      <div className="flex-shrink-0 text-center text-[9px] text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-slate-200 dark:border-slate-800">
        Stand: April 2019
      </div>
    </div>
  );
}
