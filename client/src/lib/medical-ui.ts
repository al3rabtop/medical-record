import type { Locale } from "@/i18n";

const dateFormatters: Record<Locale, Intl.DateTimeFormat> = {
  ar: new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { year: "numeric", month: "long", day: "numeric" }),
  en: new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }),
};

/** Renders a stored "YYYY-MM-DD" exam date in the given UI locale — this only affects display, never the stored value. */
export function formatMedicalDate(date: string, locale: Locale = "ar") {
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? date : dateFormatters[locale].format(parsed);
}
