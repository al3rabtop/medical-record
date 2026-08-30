import { MedicalStatusBadge } from "@/components/MedicalStatusBadge";
import { type MedicalStatus } from "@shared/medical";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, Minus } from "lucide-react";
import { CheckCircle2, CircleAlert, Info } from "lucide-react";
import { type TrendInterpretation } from "@shared/medical";
import { getTestInfo } from "@shared/testInfo";

type MetricCardProps = {
  code: string;
  label: string;
  category: string;
  value: string;
  unit: string | null;
  referenceRange: string | null;
  trend: "ارتفع" | "انخفض" | "مستقر" | "بيانات غير متوفرة";
  status: MedicalStatus;
  examDate: string;
  lastFive: Array<{ value: string; examDate: string; status: MedicalStatus }>;
  history: Array<{ value: string; examDate: string; status: MedicalStatus }>;
  interpretation: TrendInterpretation;
  onOpenHistory: () => void;
};

const trendStyle = {
  ارتفع: { Icon: ArrowUpRight, className: "bg-rose-50 text-rose-700" },
  انخفض: { Icon: ArrowDownLeft, className: "bg-sky-50 text-sky-700" },
  مستقر: { Icon: Minus, className: "bg-slate-100 text-slate-600" },
  "بيانات غير متوفرة": { Icon: Minus, className: "bg-slate-100 text-slate-500" },
};

export function MetricCard({ code, label, category, value, unit, referenceRange, trend, status, examDate, lastFive, history, interpretation, onOpenHistory }: MetricCardProps) {
  const { Icon, className } = trendStyle[trend];
  const testInfo = getTestInfo(code);
  const interpretationStyle = {
    improving: { Icon: CheckCircle2, className: "border-emerald-100 bg-emerald-50 text-emerald-900" },
    worsening: { Icon: CircleAlert, className: "border-amber-100 bg-amber-50 text-amber-900" },
    stable: { Icon: Minus, className: "border-sky-100 bg-sky-50 text-sky-900" },
    unavailable: { Icon: Info, className: "border-slate-200 bg-slate-50 text-slate-700" },
  }[interpretation.tone];
  const InterpretationIcon = interpretationStyle.Icon;
  return (
    <article onClick={onOpenHistory} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpenHistory(); } }} role="button" tabIndex={0} aria-label={`عرض سجل ${label} الكامل`} className="metric-card group cursor-pointer rounded-[1.35rem] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_-26px_rgba(15,71,63,0.55)] transition duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_18px_38px_-24px_rgba(15,71,63,0.45)] focus-visible:ring-2 focus-visible:ring-teal-700">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-teal-800">{category}</p>
          <h3 className="mt-1 text-base font-bold text-slate-900">{label}</h3>
          {testInfo && <p className="mt-0.5 text-[11px] font-semibold text-slate-500" dir="ltr">{testInfo.abbr}</p>}
        </div>
        <MedicalStatusBadge status={status} />
      </div>
      {testInfo && <p className="mt-2.5 text-xs leading-5 text-slate-500">{testInfo.about}</p>}
      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-slate-500">أحدث نتيجة</p>
          <p className="metric-value mt-1 text-3xl font-extrabold tracking-tight text-slate-950">
            {value}<span className="mr-1.5 text-sm font-semibold text-slate-500">{unit ?? ""}</span>
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">المدى المرجعي: {referenceRange ?? "غير مذكور في التقرير"}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${className}`} title={trend}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      <div className="mt-5 border-t border-dashed border-slate-200 pt-3 text-xs font-medium text-slate-500">
        آخر قياس: <span className="font-bold text-slate-700">{examDate}</span>
      </div>
      <div className="mt-3" aria-label="آخر خمس قياسات من الأقدم إلى الأحدث">
        <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-extrabold text-slate-600">آخر {Math.min(lastFive.length, 5)} نتائج — من الأقدم إلى الأحدث</span><span className="text-[10px] text-slate-400">{history.length} قياسات</span></div>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {Array.from({ length: 5 }).map((_, index) => {
            const item = lastFive[index];
            const isCurrent = index === lastFive.length - 1;
            return <div key={item?.examDate ?? `empty-${index}`} className={`min-w-0 rounded-lg px-1 py-2 text-center ${isCurrent ? "bg-teal-800 text-white" : item ? "bg-teal-50 text-teal-950" : "bg-slate-50 text-slate-300"}`}>
              <p className="truncate text-xs font-extrabold">{item?.value ?? "—"}</p>
              <p className={`mt-1 truncate text-[9px] ${isCurrent ? "text-teal-100" : "text-slate-400"}`}>{item ? item.examDate.slice(2) : ""}</p>
            </div>;
          })}
        </div>
      </div>
      <div className={`mt-4 flex gap-2.5 rounded-xl border px-3 py-2.5 ${interpretationStyle.className}`}>
        <InterpretationIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div><p className="text-xs font-extrabold">{interpretation.label}</p><p className="mt-0.5 text-[11px] leading-5 opacity-80">{interpretation.detail}</p></div>
      </div>
      <div className="mt-4 flex items-center gap-1 text-xs font-extrabold text-teal-800">اضغط على البطاقة لعرض كل النتائج <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /></div>
    </article>
  );
}
