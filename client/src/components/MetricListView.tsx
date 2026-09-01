import { MedicalStatusBadge } from "@/components/MedicalStatusBadge";
import { type MedicalStatus } from "@shared/medical";
import { getTestInfo } from "@shared/testInfo";
import { ChevronLeft } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";

type Row = {
  code: string;
  label: string;
  abbr?: string | null;
  category: string;
  value: string;
  unit: string | null;
  referenceRange: string | null;
  examDate: string;
  status: MedicalStatus;
  history: Array<{ value: string; unit: string | null; examDate: string; status: MedicalStatus }>;
};

export function MetricListView({
  cards,
  onOpen,
}: {
  cards: Row[];
  onOpen: (code: string) => void;
}) {
  const { t } = useLocale();
  return (
    <div className="overflow-hidden rounded-[1.45rem] border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-start text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-bold">{t.table.test}</th>
              <th className="px-4 py-3 font-bold">{t.table.result}</th>
              <th className="px-4 py-3 font-bold">{t.table.referenceRange}</th>
              <th className="px-4 py-3 font-bold">{t.table.lastMeasured}</th>
              <th className="px-4 py-3 font-bold">{t.table.status}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card, i) => {
              const abbr = card.abbr ?? getTestInfo(card.code)?.abbr ?? null;
              return (
                <tr
                  key={card.code}
                  onClick={() => onOpen(card.code)}
                  className={`cursor-pointer transition hover:bg-teal-50/50 ${i === 0 ? "" : "border-t border-slate-100"}`}
                >
                  <td className="px-4 py-3">
                    <span className="block font-bold text-slate-800">{card.label}</span>
                    {abbr && (
                      <span className="block text-[11px] font-semibold text-slate-400" dir="ltr">
                        {abbr}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-extrabold text-slate-950" dir="ltr">
                    {card.value}
                    {card.unit ? <span className="text-xs font-semibold text-slate-500"> {card.unit}</span> : null}
                    {card.history.length > 1 && (
                      <span className="mt-0.5 block text-[10px] font-semibold text-slate-400">
                        {card.history
                          .slice(0, -1)
                          .slice(-3)
                          .map(h => h.value)
                          .join(" ← ")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500" dir="ltr">
                    {card.referenceRange ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500" dir="ltr">{card.examDate}</td>
                  <td className="px-4 py-3">
                    <MedicalStatusBadge status={card.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    <ChevronLeft className="h-4 w-4" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
