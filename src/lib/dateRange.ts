// ============================================================================
// Date range helpers — ISO string ⇄ Date conversions
// ============================================================================
// All filter / DB / URL state stores dates as `YYYY-MM-DD` strings so they
// sort lexicographically against `created_at.slice(0, 10)`. Date objects are
// only created at the picker boundary; everything else stays as strings to
// avoid timezone drift (the picker is calendar-day, not instant).
// ============================================================================

export type Preset = "today" | "thisWeek" | "thisMonth" | "lastMonth";

export type DateRangeIso = {
  from: string; // YYYY-MM-DD or ""
  to: string; // YYYY-MM-DD or ""
};

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function toIsoDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromIsoDay(s: string): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  // Local-time midnight — matches the calendar-day semantics expected by
  // react-day-picker. Avoid `new Date(s)` which parses as UTC.
  return new Date(y, m - 1, d);
}

/** Display format for German users — DD.MM.YYYY everywhere the date is shown
 *  outside a calendar grid. Two-digit padding on day + month. */
export function formatDateDe(s: string): string {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

export function presetRange(preset: Preset): DateRangeIso {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  if (preset === "today") {
    const today = toIsoDay(now);
    return { from: today, to: today };
  }
  if (preset === "thisWeek") {
    // Monday-based week (de-DE convention).
    const day = (now.getDay() + 6) % 7;
    const start = new Date(y, m, d - day);
    return { from: toIsoDay(start), to: toIsoDay(now) };
  }
  if (preset === "thisMonth") {
    return { from: toIsoDay(new Date(y, m, 1)), to: toIsoDay(now) };
  }
  // lastMonth — full previous calendar month
  const startPrev = new Date(y, m - 1, 1);
  const endPrev = new Date(y, m, 0); // day 0 of current = last day of prev
  return { from: toIsoDay(startPrev), to: toIsoDay(endPrev) };
}

export function isPresetActive(preset: Preset, range: DateRangeIso): boolean {
  if (!range.from || !range.to) return false;
  const r = presetRange(preset);
  return range.from === r.from && range.to === r.to;
}
