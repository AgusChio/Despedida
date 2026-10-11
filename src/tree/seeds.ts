import { TZ } from "./constants.ts";

/** One curated seed per weekday, America/Argentina/Buenos_Aires. */
export const SEEDS = [
  372, // Sunday
  492, // Monday
  56, // Tuesday
  195, // Wednesday
  310, // Thursday
  614, // Friday
  959, // Saturday
] as const;

const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function localDateKey(date: Date, timeZone = TZ) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function seedForDay(date: Date, timeZone = TZ) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  const index = WEEKDAY[weekday] ?? 0;
  return SEEDS[index];
}
