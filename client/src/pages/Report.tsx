import { PortalError, PortalLoading } from "@/components/PortalState";
import { trpc } from "@/lib/trpc";
import { getLocalizedTestInfo } from "@shared/testInfo";
import { ArrowRight, Printer } from "lucide-react";
import { useLocation } from "wouter";
import { useProfile } from "@/contexts/ProfileContext";
import { useLocale } from "@/contexts/LocaleContext";

/**
 * Print-oriented summary. Rendering in the browser keeps Arabic shaping and
 * RTL correct for free, and "Print → Save as PDF" gives the user a real file
 * without shipping fonts or a PDF engine.
 */
export default function Report() {
  const { profileId } = useProfile();
  const { t, dir, locale } = useLocale();
  const [, navigate] = useLocation();
  const dashboard = trpc.medical.dashboard.useQuery(profileId ? { profileId } : undefined);
  const me = trpc.auth.me.useQuery();

  if (dashboard.isLoading) return <PortalLoading />;
  if (dashboard.error || !dashboard.data) return <PortalError />;

  const cards = dashboard.data.cards;
  const today = new Date().toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const statusText = (s: string) =>
    s === "follow_up" ? t.status.follow_up : s === "reassuring" ? t.status.reassuring : "—";

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0" dir={dir}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4; margin: 14mm; }
          body { background: #fff; }
          .sheet { box-shadow: none !important; margin: 0 !important; width: auto !important; }
          tr { break-inside: avoid; }
          thead { display: table-header-group; }
        }
      `}</style>

      <div className="no-print mx-auto mb-5 flex max-w-[210mm] items-center justify-between px-4">
        <button
          onClick={() => navigate("/labs")}
          className="flex items-center gap-2 text-sm font-bold text-teal-800 hover:underline"
        >
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          {t.report.back}
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl bg-teal-800 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-teal-900"
        >
          <Printer className="h-4 w-4" />
          {t.report.printSavePdf}
        </button>
      </div>

      <div className="sheet mx-auto w-[210mm] max-w-full bg-white p-[14mm] shadow-sm">
        <header className="mb-6 border-b-2 border-teal-800 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-teal-900">{t.report.labSummaryTitle}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {me.data?.patientName ?? "—"}
                {me.data?.birthYear ? ` · ${t.report.bornSuffix(me.data.birthYear)}` : ""}
              </p>
            </div>
            <div className="text-end text-xs text-slate-500">
              <p className="font-bold text-teal-800">{t.app.name}</p>
              <p className="mt-1">{t.report.issueDateLabel} {today}</p>
              <p>{t.report.indicatorCountLabel} {cards.length}</p>
            </div>
          </div>
        </header>

        <table className="w-full text-start text-[11px]">
          <thead>
            <tr className="bg-teal-800 text-white">
              <th className="px-2 py-2 font-bold">{t.report.tableTest}</th>
              <th className="px-2 py-2 font-bold">{t.report.tableReferenceRange}</th>
              <th className="px-2 py-2 font-bold">{t.report.tableStatus}</th>
              <th className="px-2 py-2 text-center font-bold" colSpan={5}>
                {t.report.last5Measurements}
              </th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card, i) => {
              const abbr = card.abbr ?? getLocalizedTestInfo(card.code, locale)?.abbr ?? null;
              const last5 = card.history.slice(-5);
              const pad = Array(Math.max(0, 5 - last5.length)).fill(null);
              return (
                <tr key={card.code} className={i % 2 ? "bg-slate-50" : ""}>
                  <td className="border-b border-slate-200 px-2 py-1.5">
                    <span className="block font-bold text-slate-900">{card.label}</span>
                    {abbr && (
                      <span className="block text-[9px] text-slate-500" dir="ltr">{abbr}</span>
                    )}
                  </td>
                  <td className="border-b border-slate-200 px-2 py-1.5 text-slate-600" dir="ltr">
                    {card.referenceRange ?? "—"}
                  </td>
                  <td className="border-b border-slate-200 px-2 py-1.5">
                    <span className={card.status === "follow_up" ? "font-bold text-amber-700" : "text-emerald-700"}>
                      {statusText(card.status)}
                    </span>
                  </td>
                  {[...pad, ...last5].map((h, j) => (
                    <td key={j} className="border-b border-slate-200 px-1.5 py-1.5 text-center" dir="ltr">
                      {h ? (
                        <>
                          <span className={`block ${j === 4 ? "font-extrabold text-slate-900" : "text-slate-600"}`}>
                            {h.value}
                          </span>
                          <span className="block text-[8px] text-slate-400">{h.examDate}</span>
                        </>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        <footer className="mt-6 border-t border-slate-200 pt-3 text-[9px] leading-4 text-slate-500">
          <p>
            {t.report.footerDisclaimer}
          </p>
        </footer>
      </div>
    </div>
  );
}
