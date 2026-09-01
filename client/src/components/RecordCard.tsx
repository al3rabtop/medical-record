import { trpc } from "@/lib/trpc";
import { VisitResultsEditor } from "@/components/VisitResultsEditor";
import { ViewOriginalReport } from "@/components/ViewOriginalReport";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatMedicalDate, modalityLabels, portalLabels } from "@/lib/medical-ui";
import type { RadiologyModality, RecordPortal } from "@shared/medical";
import { Building2, CalendarDays, ChevronLeft, FileText, Link2, UserRound , Trash2, Loader2 , Stethoscope } from "lucide-react";

export type PortalVisit = {
  id: number;
  visitNumber: string;
  examDate: string;
  reportDate: string | null;
  reportType: string;
  physician: string | null;
  department: string | null;
  facility: string | null;
  summary: string | null;
  summaryAr?: string | null;
  clinicalText?: string | null;
  testCount: number;
  source: string | null;
  portal: RecordPortal;
  modality: RadiologyModality | null;
};

export function RecordCard({ visit, linkedLabels = [] }: { visit: PortalVisit; linkedLabels?: string[] }) {
  const tag = visit.modality ? modalityLabels[visit.modality] : portalLabels[visit.portal];
  const [confirming, setConfirming] = useState(false);
  const utils = trpc.useUtils();
  const deleteVisit = trpc.medical.deleteVisit.useMutation({
    onSuccess: async () => {
      setConfirming(false);
      await utils.medical.invalidate();
    },
  });
  return <Dialog><DialogTrigger asChild><button className="group w-full rounded-[1.4rem] border border-slate-200 bg-white p-5 text-right shadow-[0_12px_35px_-28px_rgba(15,71,63,0.7)] transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_18px_40px_-26px_rgba(15,71,63,0.5)] focus-visible:ring-2 focus-visible:ring-teal-700"><div className="flex items-start justify-between gap-3"><span className="rounded-full bg-teal-50 px-3 py-1.5 text-[11px] font-extrabold text-teal-800">{tag}</span><span className="text-xs font-bold text-slate-500">{formatMedicalDate(visit.examDate)}</span></div><h3 className="mt-4 text-lg font-extrabold text-slate-950">{visit.reportType}</h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{visit.summaryAr ?? visit.summary ?? "لا يوجد ملخص نصي متاح لهذا السجل."}</p><div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">{visit.department && <span className="rounded-lg bg-slate-50 px-2.5 py-1.5">{visit.department}</span>}{visit.physician && <span className="rounded-lg bg-slate-50 px-2.5 py-1.5">{visit.physician}</span>}{linkedLabels.map((label) => <span key={label} className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1.5 text-violet-800"><Link2 className="h-3 w-3" />{label}</span>)}</div><div className="mt-5 flex items-center gap-1 text-xs font-extrabold text-teal-800">عرض التقرير المنظم <ChevronLeft className="h-3.5 w-3.5" /></div></button></DialogTrigger><DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto border-slate-200 bg-[#fbfcfb] p-0 sm:max-w-2xl"><DialogHeader className="border-b border-slate-200 bg-white px-6 py-6 text-right sm:px-8"><p className="text-xs font-extrabold text-teal-700">{tag}</p><DialogTitle className="mt-1 text-2xl font-extrabold text-slate-950">{visit.reportType}</DialogTitle><DialogDescription className="mt-2 text-sm text-slate-600">سجل منقول ومنظم من الملف المصدر، وليس تفسيراً تشخيصياً جديداً.</DialogDescription></DialogHeader><div className="space-y-5 px-6 py-6 sm:px-8"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl bg-teal-800 p-4 text-white"><p className="text-xs font-bold text-teal-100">تاريخ الفحص</p><p className="mt-2 font-extrabold">{formatMedicalDate(visit.examDate)}</p></div><div className="rounded-xl bg-white p-4 shadow-sm"><p className="flex items-center gap-1 text-xs font-bold text-slate-500"><Building2 className="h-3.5 w-3.5" />المنشأة</p><p className="mt-2 font-extrabold text-slate-900">{visit.facility ?? "غير مذكورة في التقرير"}</p></div><div className="rounded-xl bg-white p-4 shadow-sm"><p className="flex items-center gap-1 text-xs font-bold text-slate-500"><Building2 className="h-3.5 w-3.5" />القسم</p><p className="mt-2 font-extrabold text-slate-900">{visit.department ?? "غير مذكور"}</p></div><div className="rounded-xl bg-white p-4 shadow-sm"><p className="flex items-center gap-1 text-xs font-bold text-slate-500"><UserRound className="h-3.5 w-3.5" />الطبيب</p><p className="mt-2 font-extrabold text-slate-900">{visit.physician ?? "غير مذكور"}</p></div></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="flex items-center gap-2 font-extrabold text-slate-900"><FileText className="h-4 w-4 text-teal-700" />الملخص المبسّط</h3><p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{visit.summaryAr ?? visit.summary ?? "لا يوجد ملخص نصي متاح لهذا السجل."}</p></div>{visit.clinicalText && <div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="flex items-center gap-2 font-extrabold text-slate-900"><Stethoscope className="h-4 w-4 text-teal-700" />النص الطبي الأصلي</h3><p className="mt-3 whitespace-pre-line text-xs leading-6 text-slate-600" dir="ltr">{visit.clinicalText}</p><p className="mt-3 text-[11px] text-slate-400">النص كما ورد في التقرير، لمراجعة الطبيب.</p></div>}{linkedLabels.length > 0 && <div className="flex items-start gap-2 rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-900"><Link2 className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-extrabold">سجلات مرتبطة</p><ul className="mt-1 space-y-1">{linkedLabels.map((label) => <li key={label}>{label}</li>)}</ul></div></div>}<div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-2">{visit.reportDate && <p className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />تاريخ اعتماد النتيجة: {formatMedicalDate(visit.reportDate)}</p>}{visit.source && <p>المصدر: <span className="font-bold text-slate-700">{visit.source}</span></p>}</div><p className="border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">يُرجع إلى الملف الأصلي والطبيب لفهم السياق الطبي الكامل.</p><div className="border-t border-slate-200 pt-4"><div className="mb-3 flex flex-wrap gap-2"><VisitResultsEditor visitId={visit.id} /><ViewOriginalReport visitId={visit.id} /></div>{!confirming ? <button onClick={() => setConfirming(true)} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" />حذف هذا السجل</button> : <div className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="text-sm font-extrabold text-red-800">تأكيد الحذف</p><p className="mt-1 text-xs leading-5 text-red-700">سيتم حذف هذا السجل وجميع نتائجه نهائياً. لا يمكن التراجع.</p>{deleteVisit.error && <p className="mt-2 text-xs font-bold text-red-800">{deleteVisit.error.message}</p>}<div className="mt-3 flex gap-2"><button onClick={() => deleteVisit.mutate({ visitId: visit.id })} disabled={deleteVisit.isPending} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60">{deleteVisit.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}نعم، احذف</button><button onClick={() => setConfirming(false)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600">إلغاء</button></div></div>}</div></div></DialogContent></Dialog>;
}
