// ============================================================================
// LegalPage — Allgemeine Geschäftsbedingungen (AGB)
// ============================================================================
// Renders as the final page of the public catalog flipbook (and admin Vitrine).
// Locale always German — legal text is not translated.
// ============================================================================

type Section = { id: string; title: string; items: string[] };

const SECTIONS: Section[] = [
  {
    id: "1",
    title: "§ 1 Geltungsbereich",
    items: [
      "Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für sämtliche Geschäftsbeziehungen zwischen der Sock Off Berlin Souvenirs GmbH (nachfolgend „Verkäufer“) und ihren Kunden.",
      "Abweichende, entgegenstehende oder ergänzende Allgemeine Geschäftsbedingungen des Kunden werden nur dann Vertragsbestandteil, wenn ihrer Geltung ausdrücklich schriftlich zugestimmt wurde.",
      "Diese AGB gelten in ihrer jeweils zum Zeitpunkt des Vertragsschlusses gültigen Fassung.",
    ],
  },
  {
    id: "2",
    title: "§ 2 Vertragsschluss",
    items: [
      "Die Präsentation von Waren, Preislisten und Angeboten stellt kein rechtlich bindendes Angebot dar, sondern eine unverbindliche Aufforderung zur Bestellung.",
      "Durch die Bestellung der Ware gibt der Kunde ein verbindliches Angebot zum Abschluss eines Kaufvertrags ab.",
      "Der Vertrag kommt erst durch schriftliche Auftragsbestätigung oder durch Auslieferung der Ware zustande.",
    ],
  },
  {
    id: "3",
    title: "§ 3 Preise und Angebote",
    items: [
      "Sämtliche Preise verstehen sich netto zuzüglich der jeweils geltenden gesetzlichen Mehrwertsteuer, sofern nicht ausdrücklich anders angegeben.",
      "Preisänderungen, Druckfehler, technische Änderungen sowie Irrtümer bleiben vorbehalten.",
      "Geringfügige Abweichungen bei Farben, Materialien, Größen oder Ausführungen gelten als handelsüblich und stellen keinen Mangel dar.",
    ],
  },
  {
    id: "4",
    title: "§ 4 Lieferung und Versand",
    items: [
      "Lieferungen erfolgen zum frühestmöglichen Zeitpunkt, sofern keine abweichenden Lieferfristen vereinbart wurden.",
      "Der Versand erfolgt nach Wahl des Verkäufers per Post, Paketdienst oder Spedition.",
      "Die Gefahr des zufälligen Untergangs oder der zufälligen Verschlechterung der Ware geht mit Übergabe an das Transportunternehmen auf den Kunden über, sofern der Kunde Unternehmer im Sinne des § 14 BGB ist.",
      "Lieferverzögerungen aufgrund höherer Gewalt oder sonstiger unvorhersehbarer Ereignisse, die außerhalb des Einflussbereichs des Verkäufers liegen, berechtigen nicht zu Schadensersatzansprüchen.",
    ],
  },
  {
    id: "5",
    title: "§ 5 Zahlung und Eigentumsvorbehalt",
    items: [
      "Rechnungen sind innerhalb von 10 Tagen ab Rechnungsdatum ohne Abzug zahlbar, sofern nichts anderes vereinbart wurde.",
      "Der Verkäufer behält sich vor, Lieferungen ausschließlich gegen Vorkasse auszuführen.",
      "Bei Zahlungsverzug ist der Verkäufer berechtigt, Verzugszinsen in gesetzlicher Höhe zu verlangen.",
      "Zusätzlich können Mahnkosten in angemessener Höhe berechnet werden.",
      "Die gelieferte Ware bleibt bis zur vollständigen Bezahlung sämtlicher Forderungen aus der Geschäftsbeziehung Eigentum der Sock Off Berlin Souvenirs GmbH.",
    ],
  },
  {
    id: "6",
    title: "§ 6 Rückgabe und Reklamation",
    items: [
      "Reklamationen wegen offensichtlicher Mängel sind unverzüglich nach Erhalt der Ware schriftlich mitzuteilen.",
      "Rückgaben werden ausschließlich nach vorheriger Absprache akzeptiert.",
      "Individuell angefertigte oder personalisierte Produkte sind von Rückgabe und Umtausch ausgeschlossen, sofern kein gesetzlicher Mangel vorliegt.",
      "Handelsübliche oder materialbedingte Abweichungen, insbesondere bei Naturmaterialien wie Baumwolle, stellen keinen Reklamationsgrund dar.",
    ],
  },
  {
    id: "7",
    title: "§ 7 Haftung",
    items: [
      "Die Sock Off Berlin Souvenirs GmbH haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit.",
      "Ebenso haftet der Verkäufer unbeschränkt bei Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit sowie nach den Vorschriften des Produkthaftungsgesetzes.",
      "Bei einfacher Fahrlässigkeit haftet der Verkäufer nur bei Verletzung wesentlicher Vertragspflichten (Kardinalpflichten) und beschränkt auf den vertragstypischen, vorhersehbaren Schaden.",
      "Eine Haftung für mittelbare Schäden, Folgeschäden oder entgangenen Gewinn ist – soweit gesetzlich zulässig – ausgeschlossen.",
    ],
  },
  {
    id: "8",
    title: "§ 8 Urheberrechte und Druckvorlagen",
    items: [
      "Stellt der Kunde Druckvorlagen, Logos, Motive oder sonstige Inhalte zur Verfügung, versichert er, dass dadurch keine Rechte Dritter verletzt werden.",
      "Der Kunde stellt die Sock Off Berlin Souvenirs GmbH von sämtlichen Ansprüchen Dritter wegen Urheber-, Marken- oder sonstiger Rechtsverletzungen frei.",
      "Entwürfe, Muster, Skizzen, Probedrucke und sonstige durch den Verkäufer erstellte Arbeitsmittel bleiben Eigentum der Sock Off Berlin Souvenirs GmbH, sofern nichts anderes schriftlich vereinbart wurde.",
    ],
  },
  {
    id: "9",
    title: "§ 9 Produkteigenschaften",
    items: [
      "Viele angebotene Produkte bestehen überwiegend aus Baumwolle oder anderen Naturmaterialien.",
      "Materialbedingte Unterschiede hinsichtlich Farbe, Struktur, Elastizität, Gewicht oder Waschverhalten sind naturbedingt und stellen keinen Sachmangel dar.",
    ],
  },
  {
    id: "10",
    title: "§ 10 Salvatorische Klausel",
    items: [
      "Sollte eine Bestimmung dieser AGB ganz oder teilweise unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt. Anstelle der unwirksamen Regelung gilt die gesetzlich zulässige Regelung als vereinbart, die dem wirtschaftlichen Zweck am nächsten kommt.",
    ],
  },
  {
    id: "11",
    title: "§ 11 Anwendbares Recht und Gerichtsstand",
    items: [
      "Es gilt ausschließlich das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.",
      "Ist der Kunde Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen, ist Gerichtsstand für alle Streitigkeiten aus der Geschäftsbeziehung Berlin.",
      "Erfüllungsort für Lieferungen und Zahlungen ist Berlin.",
    ],
  },
];

export const LEGAL_PAGE_COUNT = 2;

const PART_RANGES: Record<1 | 2, [number, number]> = {
  1: [0, 6],   // § 1 – § 6
  2: [6, 11],  // § 7 – § 11
};

export default function LegalPage({ part = 1 }: { part?: 1 | 2 }) {
  const [from, to] = PART_RANGES[part];
  const sections = SECTIONS.slice(from, to);
  const isFirst = part === 1;

  return (
    <div className="h-full flex flex-col px-6 py-5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      <div className="flex-shrink-0 text-center pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-sky-700 dark:text-sky-400">
          Sock Off Berlin Souvenirs GmbH
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50 mt-1">
          Allgemeine Geschäftsbedingungen
          {!isFirst && (
            <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
              (Fortsetzung)
            </span>
          )}
        </h2>
      </div>
      <div className="flex-1 min-h-0 columns-2 gap-5 text-[10.5px] leading-relaxed overflow-hidden">
        {sections.map((s) => (
          <section key={s.id} className="break-inside-avoid mb-3">
            <h3 className="font-semibold text-[11.5px] mb-1 text-slate-900 dark:text-slate-50">
              {s.title}
            </h3>
            {s.items.length === 1 ? (
              <p className="text-justify hyphens-auto" style={{ hyphens: "auto" }}>
                {s.items[0]}
              </p>
            ) : (
              <ol className="list-decimal pl-4 space-y-1">
                {s.items.map((item, i) => (
                  <li
                    key={i}
                    className="text-justify hyphens-auto"
                    style={{ hyphens: "auto" }}
                  >
                    {item}
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>
      <div className="flex-shrink-0 text-center text-[9px] text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-slate-200 dark:border-slate-800">
        Seite {part} / {LEGAL_PAGE_COUNT}
      </div>
    </div>
  );
}
