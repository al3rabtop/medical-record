import React from "react";
import { MedicalStatusBadge } from "@/components/MedicalStatusBadge";
import { type MedicalStatus, type TrendInterpretationKey } from "@shared/medical";
import { BarChart3, BookOpen, CalendarDays, CircleAlert, Stethoscope } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getLocalizedTestInfo, getLocalizedTestName } from "@shared/testInfo";
import { MetricTrendChart } from "@/components/MetricTrendChart";
import { FollowUpReminder } from "@/components/FollowUpReminder";
import { ViewOriginalReport } from "@/components/ViewOriginalReport";
import { useLocale } from "@/contexts/LocaleContext";
import type { Dictionary } from "@/i18n";

type MetricHistoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: {
    code: string;
    resultId: number;
    visitId: number;
    followUpDate?: string | null;
    abbr?: string | null;
    about?: string | null;
    label: string;
    category: string;
    value: string;
    unit: string | null;
    referenceRange: string | null;
    examDate: string;
    status: MedicalStatus;
    interpretation: { tone: string; key: TrendInterpretationKey };
    history: Array<{ visitId: number; value: string; unit: string | null; referenceRange: string | null; facility: string | null; examDate: string; status: MedicalStatus }>;
    hasUnitMismatch?: boolean;
    hasRangeMismatch?: boolean;
    facilities?: string[];
  } | null;
};

export function MetricHistoryTable({ history, t: dict }: { history: Array<{ value: string; unit: string | null; referenceRange: string | null; facility: string | null; examDate: string; status: MedicalStatus }>; t: Dictionary }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-start text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="px-4 py-3 font-bold">{dict.recordCard.examDate}</th>
            <th className="px-4 py-3 font-bold">{dict.table.result}</th>
            {/* Each row shows the range it was actually judged against, since
                ranges differ by lab and by assay kit. */}
            <th className="px-4 py-3 font-bold">{dict.table.referenceRange}</th>
            <th className="px-4 py-3 font-bold">{dict.metricHistory.laboratory}</th>
            <th className="px-4 py-3 font-bold">{dict.table.status}</th>
          </tr>
        </thead>
        <tbody>
          {history.map((item, index) => (
            <tr
              key={`${item.examDate}-${index}`}
              className={index === history.length - 1 ? "bg-teal-50/60 dark:bg-teal-950/30" : "border-t border-slate-100"}
            >
              <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-700">{item.examDate}</td>
              <td className="whitespace-nowrap px-4 py-3 font-extrabold text-slate-950">
                {item.value} <span className="text-xs font-semibold text-slate-500">{item.unit ?? "—"}</span>
                {index === history.length - 1 && (
                  <span className="mr-2 rounded-full bg-teal-800 px-2 py-0.5 text-[10px] text-white">{dict.metricHistory.latestBadge}</span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600" dir="ltr">
                {item.referenceRange ?? "—"}
              </td>
              <td className="max-w-40 truncate px-4 py-3 text-xs text-slate-500">
                {item.facility ?? "—"}
              </td>
              <td className="px-4 py-3"><MedicalStatusBadge status={item.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MetricHistoryDialog({ open, onOpenChange, card }: MetricHistoryDialogProps) {
  const { t, dir, locale } = useLocale();
  if (!card) return null;
  const interpretationText = t.interpretation[card.interpretation.key];
  // TEST_INFO's "abbr" (English scientific name) and "about" (Arabic-only
  // prose) each exist in only one language — shown only in the matching
  // locale rather than stacking both under one heading. "about" only ever
  // exists in Arabic in this system, so English mode always uses the
  // properly-localized default description instead of falling back to it.
  const localizedInfo = getLocalizedTestInfo(card.code, locale);
  const displayLabel = getLocalizedTestName(card.code, locale, card.label);
  const dialogAbbr = card.abbr ?? localizedInfo?.abbr ?? null;
  const dialogAbout = locale === "ar" ? (card.about ?? localizedInfo?.about ?? t.metricHistory.defaultAbout) : t.metricHistory.defaultAbout;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={dir} className="max-h-[90vh] overflow-y-auto border-slate-200 bg-card p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-slate-200 bg-white px-6 py-6 text-right sm:px-8">
          <div className="flex items-start justify-between gap-4 pl-8">
            <div><p className="text-xs font-extrabold text-teal-700">{card.category} · {t.metricHistory.fullRecord}</p><DialogTitle className="mt-1 text-2xl font-extrabold text-slate-950">{displayLabel}</DialogTitle>{dialogAbbr && <p className="mt-1 text-xs font-semibold text-slate-500" dir="ltr">{dialogAbbr}</p>}<DialogDescription className="mt-2 text-sm leading-6 text-slate-600">{dialogAbout}</DialogDescription></div>
            <MedicalStatusBadge status={card.status} />
          </div>
        </DialogHeader>
        <div className="space-y-5 px-6 py-6 sm:px-8">
          <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-teal-800 p-4 text-white"><p className="text-xs font-bold text-teal-100">{t.metricCard.latestResult}</p><p className="mt-1 text-3xl font-extrabold">{card.value}<span className="mr-1 text-xs text-teal-100">{card.unit ?? ""}</span></p><p className="mt-2 text-[11px] text-teal-100">{card.examDate}</p></div><div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs font-bold text-slate-500">{t.table.referenceRange}</p><p className="mt-2 font-extrabold text-slate-900">{card.referenceRange ?? t.common.notMentioned}</p></div><div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs font-bold text-slate-500">{t.metricHistory.measurementCount}</p><p className="mt-2 flex items-center gap-2 text-xl font-extrabold text-slate-900"><BarChart3 className="h-4 w-4 text-teal-700" />{card.history.length}</p></div></div>
          <div className="flex flex-wrap gap-2"><ViewOriginalReport visitIds={Array.from(new Set(card.history.map((item) => item.visitId)))} /></div>
          <div className="rounded-xl border border-teal-100 bg-teal-50 p-4 dark:border-teal-900/50 dark:bg-teal-950/30"><div className="flex gap-2"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-teal-800 dark:text-teal-300" /><div><p className="text-sm font-extrabold text-teal-950 dark:text-teal-100">{interpretationText.label}</p><p className="mt-1 text-sm leading-6 text-teal-900/80 dark:text-teal-200/80">{interpretationText.detail}</p></div></div></div>
          {(card.hasUnitMismatch || card.hasRangeMismatch) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="flex items-center gap-2 font-extrabold">
                <CircleAlert className="h-4 w-4 shrink-0" />
                {t.metricHistory.incomparableTitle}
              </p>
              <p className="mt-2 leading-6">
                {card.hasUnitMismatch && card.hasRangeMismatch
                  ? t.metricHistory.unitAndRangeMismatch
                  : card.hasUnitMismatch
                    ? t.metricHistory.unitMismatch
                    : t.metricHistory.rangeMismatch}{" "}
                {t.metricHistory.mismatchExplanation}
              </p>
              <p className="mt-2 leading-6 font-bold">
                {t.metricHistory.mismatchInstruction}
              </p>
              {card.facilities && card.facilities.length > 1 && (
                <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
                  {t.metricHistory.labsInThisRecord} {card.facilities.join(" · ")}
                </p>
              )}
            </div>
          )}<FollowUpReminder resultId={card.resultId} followUpDate={card.followUpDate ?? null} /><div><h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900"><BarChart3 className="h-4 w-4 text-teal-700" />{t.metricHistory.trendOverTime}</h3><div className="mt-3 rounded-xl border border-slate-200 bg-white p-3"><MetricTrendChart history={card.history} referenceRange={card.referenceRange} status={card.status} /></div></div><div><h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900"><CalendarDays className="h-4 w-4 text-teal-700" />{t.metricHistory.allRecordedResults}</h3><MetricHistoryTable history={card.history} t={t} /></div>
          {(() => {
            // "why" (Arabic, patient-friendly framing) and "clinical" (English,
            // physician-oriented framing) are two different pieces of content,
            // each written in only one language — never both languages for the
            // same locale, so only the one matching the active locale renders.
            if (!localizedInfo?.why && !localizedInfo?.clinical) return null;
            return (
              <div className="border-t border-slate-200 pt-5">
                {localizedInfo.why && (
                  <div className="rounded-xl bg-slate-50 p-4">
                    <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                      <BookOpen className="h-4 w-4 text-teal-700" />
                      {t.metricHistory.whyOrdered}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{localizedInfo.why}</p>
                  </div>
                )}
                {localizedInfo.clinical && (
                  <div className="mt-3 rounded-xl border border-slate-200 p-4">
                    <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                      <Stethoscope className="h-4 w-4 text-teal-700" />
                      {t.metricHistory.clinicalNote}
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-slate-600" dir="ltr">{localizedInfo.clinical}</p>
                  </div>
                )}
                <p className="mt-3 text-[11px] leading-5 text-slate-400">
                  {t.metricHistory.generalInfoDisclaimer}
                </p>
              </div>
            );
          })()}
          <p className="text-xs leading-5 text-slate-500">{t.metricHistory.footerNote}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
