import { Check, ChevronDown, Copy, Lightbulb } from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";

/**
 * Turns an upload failure into an actionable path: the user takes their
 * original report to any AI assistant with this prompt, and gets back a
 * clean one-page summary that this app can read easily and cheaply.
 */
export function UploadTroubleshooting() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(t.uploadTroubleshooting.helperPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the prompt stays visible to select manually.
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-right"
      >
        <span className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          {t.uploadTroubleshooting.toggleLabel}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-4">
          <p className="text-sm font-bold text-slate-700">{t.uploadTroubleshooting.commonCausesTitle}</p>
          <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-600">
            <li>• {t.uploadTroubleshooting.cause1}</li>
            <li>• {t.uploadTroubleshooting.cause2}</li>
            <li>• {t.uploadTroubleshooting.cause3}</li>
          </ul>

          <p className="mt-4 text-sm leading-6 text-slate-700">
            {t.uploadTroubleshooting.solutionText}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {t.uploadTroubleshooting.acceptedFormatsNote}
          </p>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap text-xs leading-6 text-slate-700">
              {t.uploadTroubleshooting.helperPrompt}
            </pre>
          </div>

          <button
            onClick={copy}
            className="mt-3 flex items-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-900"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? t.uploadTroubleshooting.copied : t.uploadTroubleshooting.copyText}
          </button>

          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <span className="font-extrabold">{t.uploadTroubleshooting.beforeSavingLabel}</span> {t.uploadTroubleshooting.beforeSavingWarning}
          </p>
        </div>
      )}
    </div>
  );
}
