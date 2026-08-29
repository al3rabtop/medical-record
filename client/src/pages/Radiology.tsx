import { MedicalNotice, PortalShell } from "@/components/PortalShell";
import { PortalPageHeader } from "@/components/PortalPageHeader";
import { PortalError, PortalLoading } from "@/components/PortalState";
import { RecordCard } from "@/components/RecordCard";
import { modalityLabels } from "@/lib/medical-ui";
import { trpc } from "@/lib/trpc";
import type { RadiologyModality } from "@shared/medical";
import { ScanLine } from "lucide-react";
import { useMemo, useState } from "react";

export default function Radiology() {
  const dashboard = trpc.medical.dashboard.useQuery();
  const [activeModality, setActiveModality] = useState<"الكل" | RadiologyModality>("الكل");
  const records = useMemo(() => (dashboard.data?.visits ?? []).filter((visit) => visit.portal === "radiology"), [dashboard.data?.visits]);
  const modalities = useMemo(() => Array.from(new Set(records.map((visit) => visit.modality).filter((item): item is RadiologyModality => item !== null))), [records]);
  if (dashboard.isLoading) return <PortalShell><PortalLoading /></PortalShell>;
  if (dashboard.error || !dashboard.data) return <PortalShell><PortalError /></PortalShell>;
  const visibleRecords = records.filter((visit) => activeModality === "الكل" || visit.modality === activeModality);
  return <PortalShell><PortalPageHeader eyebrow="بوابة الأشعة" title="الدراسات التصويرية حسب نوعها" description="تقارير الأشعة منفصلة عن التحاليل، ومصنفة حسب تقنية التصوير لتسهيل الوصول إلى الدراسة المطلوبة." Icon={ScanLine} countLabel={`${records.length} تقارير أشعة`} /><section className="container mt-8"><MedicalNotice /></section><section className="container mt-10"><div><p className="section-kicker">تصنيف الأشعة</p><h2 className="section-title">اختر تقنية التصوير</h2><p className="mt-2 text-sm text-slate-600">كل بطاقة تفتح التقرير المنظم وتعرض المصدر والتاريخ والجهة.</p></div><div className="mt-5 flex gap-2 overflow-x-auto pb-2"><button onClick={() => setActiveModality("الكل")} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${activeModality === "الكل" ? "bg-teal-800 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>الكل · {records.length}</button>{modalities.map((modality) => <button key={modality} onClick={() => setActiveModality(modality)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${activeModality === modality ? "bg-teal-800 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{modalityLabels[modality]} · {records.filter((item) => item.modality === modality).length}</button>)}</div><div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleRecords.map((visit) => <RecordCard key={visit.id} visit={visit} />)}{!visibleRecords.length && <p className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">لا توجد تقارير ضمن هذا النوع.</p>}</div></section></PortalShell>;
}
