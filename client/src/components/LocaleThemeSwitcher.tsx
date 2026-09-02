import { Moon, Sun } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Language + theme controls. Switching either only updates UI strings,
 * direction, and CSS variables locally — it never re-fetches medical data,
 * re-uploads documents, or calls any API.
 */
export function LocaleThemeSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="flex items-center gap-0.5 rounded-full border border-slate-200 bg-white p-1" role="group" aria-label={t.locale.label}>
        <button
          type="button"
          onClick={() => setLocale("ar")}
          aria-pressed={locale === "ar"}
          className={`rounded-full px-2.5 py-1.5 text-xs font-bold transition ${locale === "ar" ? "bg-teal-800 text-white" : "text-slate-600 hover:bg-teal-50 dark:hover:bg-teal-950/40"}`}
        >
          {t.locale.ar}
        </button>
        <button
          type="button"
          onClick={() => setLocale("en")}
          aria-pressed={locale === "en"}
          className={`rounded-full px-2.5 py-1.5 text-xs font-bold transition ${locale === "en" ? "bg-teal-800 text-white" : "text-slate-600 hover:bg-teal-50 dark:hover:bg-teal-950/40"}`}
        >
          {t.locale.en}
        </button>
      </div>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? t.theme.light : t.theme.dark}
        title={theme === "dark" ? t.theme.light : t.theme.dark}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </div>
  );
}
