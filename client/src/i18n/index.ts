import { ar } from "./ar";
import { en, type Dictionary } from "./en";

export type Locale = "ar" | "en";

export const dictionaries: Record<Locale, Dictionary> = { ar, en };

export const dirFor: Record<Locale, "rtl" | "ltr"> = { ar: "rtl", en: "ltr" };

export type { Dictionary };
