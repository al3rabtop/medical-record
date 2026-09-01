import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { dictionaries, dirFor, type Dictionary, type Locale } from "@/i18n";

type LocaleContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dir: "rtl" | "ltr";
  t: Dictionary;
};

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);
const STORAGE_KEY = "locale";

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "ar";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "en" ? "en" : "ar";
}

/**
 * Arabic is the default/primary language — an unset or invalid stored value
 * always falls back to "ar", never "en".
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  useEffect(() => {
    const root = document.documentElement;
    root.dir = dirFor[locale];
    root.lang = locale;
  }, [locale]);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale, dir: dirFor[locale], t: dictionaries[locale] }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
}
