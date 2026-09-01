import React from "react";
import { MedicalStatusBadge } from "@/components/MedicalStatusBadge";
import { type MedicalStatus, type TrendInterpretation } from "@shared/medical";
import { BarChart3, BookOpen, CalendarDays, CircleAlert, Stethoscope } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getTestInfo } from "@shared/testInfo";
import { MetricTrendChart } from "@/components/MetricTrendChart";
import { FollowUpReminder } from "@/components/FollowUpReminder";
import { ViewOriginalReport } from "@/components/ViewOriginalReport";

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
    interpretation: TrendInterpretation;
    history: Array<{ value: string; unit: string | null; referenceRange: string | null; facility: string | null; examDate: string; status: MedicalStatus }>;
    hasUnitMismatch?: boolean;
    hasRangeMismatch?: boolean;
    facilities?: string[];
  } | null;
};

export function MetricHistoryTable({ history }: { history: Array<{ value: string; unit: string | null; referenceRange: string | null; facility: string | null; examDate: string; status: MedicalStatus }> }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-right text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="px-4 py-3 font-bold">تاريخ الفحص</th>
            <th className="px-4 py-3 font-bold">النتيجة</th>
            {/* Each row shows the range it was actually judged against, since
                ranges differ by lab and by assay kit. */}
            <th className="px-4 py-3 font-bold">المدى المرجعي</th>
            <th className="px-4 py-3 font-bold">المختبر</th>
            <th className="px-4 py-3 font-bold">الحالة</th>
          </tr>
        </thead>
        <tbody>
          {history.map((item, index) => (
            <tr
              key={`${item.examDate}-${index}`}
              className={index === history.length - 1 ? "bg-teal-50/60" : "border-t border-slate-100"}
            >
              <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-700">{item.examDate}</td>
              <td className="whitespace-nowrap px-4 py-3 font-extrabold text-slate-950">
                {item.value} <span className="text-xs font-semibold text-slate-500">{item.unit ?? "—"}</span>
                {index === history.length - 1 && (
                  <span className="mr-2 rounded-full bg-teal-800 px-2 py-0.5 text-[10px] text-white">الأحدث</span>
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
  if (!card) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto border-slate-200 bg-[#fbfcfb] p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-slate-200 bg-white px-6 py-6 text-right sm:px-8">
          <div className="flex items-start justify-between gap-4 pl-8">
            <div><p className="text-xs font-extrabold text-teal-700">{card.category} · السجل الكامل</p><DialogTitle className="mt-1 text-2xl font-extrabold text-slate-950">{card.label}</DialogTitle>{(card.abbr ?? getTestInfo(card.code)?.abbr) && <p className="mt-1 text-xs font-semibold text-slate-500" dir="ltr">{card.abbr ?? getTestInfo(card.code)!.abbr}</p>}<DialogDescription className="mt-2 text-sm leading-6 text-slate-600">{card.about ?? getTestInfo(card.code)?.about ?? "جميع القياسات المسجلة مرتبة من الأقدم إلى الأحدث."}</DialogDescription></div>
            <MedicalStatusBadge status={card.status} />
          </div>
        </DialogHeader>
        <div className="space-y-5 px-6 py-6 sm:px-8">
          <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-teal-800 p-4 text-white"><p className="text-xs font-bold text-teal-100">أحدث نتيجة</p><p className="mt-1 text-3xl font-extrabold">{card.value}<span className="mr-1 text-xs text-teal-100">{card.unit ?? ""}</span></p><p className="mt-2 text-[11px] text-teal-100">{card.examDate}</p></div><div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs font-bold text-slate-500">المدى المرجعي</p><p className="mt-2 font-extrabold text-slate-900">{card.referenceRange ?? "غير مذكور"}</p></div><div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs font-bold text-slate-500">عدد القياسات</p><p className="mt-2 flex items-center gap-2 text-xl font-extrabold text-slate-900"><BarChart3 className="h-4 w-4 text-teal-700" />{card.history.length}</p></div></div>
          <div className="flex flex-wrap gap-2"><ViewOriginalReport visitId={card.visitId} /></div>
          <div className="rounded-xl border border-teal-100 bg-teal-50 p-4"><div className="flex gap-2"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-teal-800" /><div><p className="text-sm font-extrabold text-teal-950">{card.interpretation.label}</p><p className="mt-1 text-sm leading-6 text-teal-900/80">{card.interpretation.detail}</p></div></div></div>
          {(card.hasUnitMismatch || card.hasRangeMismatch) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-900">
              <p className="flex items-center gap-2 font-extrabold">
                <CircleAlert className="h-4 w-4 shrink-0" />
                انتبه: هذه القياسات غير قابلة للمقارنة المباشرة
              </p>
              <p className="mt-2 leading-6">
                {card.hasUnitMismatch && card.hasRangeMismatch
                  ? "أُجريت هذه القياسات بوحدات قياس ومدايات مرجعية مختلفة."
                  : card.hasUnitMismatch
                    ? "أُجريت هذه القياسات بوحدات قياس مختلفة."
                    : "أُجريت هذه القياسات بمدايات مرجعية مختلفة."}{" "}
                هذا طبيعي: كل مختبر يستخدم أجهزة ومواد فحص خاصة به، وقد يغيّرها المختبر
                نفسه مع الوقت، فيتغيّر معها ما يُعتبر «طبيعياً».
              </p>
              <p className="mt-2 leading-6 font-bold">
                لذلك قارن كل نتيجة مع المدى المرجعي المكتوب بجانبها في الجدول أدناه، لا
                مع الأرقام الأخرى مباشرة.
              </p>
              {card.facilities && card.facilities.length > 1 && (
                <p className="mt-2 text-xs text-amber-800">
                  المختبرات في هذا السجل: {card.facilities.join(" · ")}
                </p>
              )}
            </div>
          )}<FollowUpReminder resultId={card.resultId} followUpDate={card.followUpDate ?? null} /><div><h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900"><BarChart3 className="h-4 w-4 text-teal-700" />التطور عبر الزمن</h3><div className="mt-3 rounded-xl border border-slate-200 bg-white p-3"><MetricTrendChart history={card.history} referenceRange={card.referenceRange} status={card.status} /></div></div><div><h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900"><CalendarDays className="h-4 w-4 text-teal-700" />جميع النتائج المسجلة</h3><MetricHistoryTable history={card.history} /></div>
          {(() => {
            const info = getTestInfo(card.code);
            if (!info?.why && !info?.clinical) return null;
            return (
              <div className="border-t border-slate-200 pt-5">
                {info.why && (
                  <div className="rounded-xl bg-slate-50 p-4">
                    <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                      <BookOpen className="h-4 w-4 text-teal-700" />
                      لماذا يُطلب هذا الفحص؟
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{info.why}</p>
                  </div>
                )}
                {info.clinical && (
                  <div className="mt-3 rounded-xl border border-slate-200 p-4">
                    <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                      <Stethoscope className="h-4 w-4 text-teal-700" />
                      Clinical note
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-slate-600" dir="ltr">{info.clinical}</p>
                  </div>
                )}
                <p className="mt-3 text-[11px] leading-5 text-slate-400">
                  معلومات عامة للتوعية فقط، وليست تفسيراً لنتيجتك ولا بديلاً عن رأي الطبيب.
                </p>
              </div>
            );
          })()}
          <p className="text-xs leading-5 text-slate-500">تُعرض النتائج كما وردت في التقارير. وصف الاتجاه يساعد على متابعة التغير مع الوقت وليس تشخيصاً طبياً.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
