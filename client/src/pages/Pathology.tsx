import { MedicalNotice, PortalShell } from "@/components/PortalShell";
import { PortalPageHeader } from "@/components/PortalPageHeader";
import { PortalError, PortalLoading } from "@/components/PortalState";
import { RecordCard } from "@/components/RecordCard";
import { formatMedicalDate } from "@/lib/medical-ui";
import { trpc } from "@/lib/trpc";
import { Dna, Link2 } from "lucide-react";

export default function Pathology() {
  const dashboard = trpc.medical.dashboard.useQuery();
  if (dashboard.isLoading) return <PortalShell><PortalLoading /></PortalShell>;
  if (dashboard.error || !dashboard.data) return <PortalShell><PortalError /></PortalShell>;
  const records = dashboard.data.visits.filter((visit) => visit.portal === "pathology").sort((a, b) => Number(a.reportType.includes("علم الأمراض")) - Number(b.reportType.includes("علم الأمراض")));
  const oncologyVisit = dashboard.data.visits.find((visit) => visit.portal === "physician" && visit.department === "الأورام");
  const oncologyLink = oncologyVisit ? `مرتبط بزيارة ${oncologyVisit.department} — ${formatMedicalDate(oncologyVisit.examDate)}` : null;

  return <PortalShell><PortalPageHeader eyebrow="بوابة الخزعات وعلم الأمراض" title="الإجراء والنتيجة النسيجية معاً" description="هذه البوابة تربط إجراء أخذ العينة بنتيجة علم الأمراض التابعة له، وزيارة الطبيب المرتبطة به، من دون خلطها مع اتجاهات التحاليل الدورية." Icon={Dna} countLabel={`${records.length} سجلان مترابطان`} /><section className="container mt-8"><MedicalNotice /></section><section className="container mt-10"><div className="rounded-[1.5rem] border border-violet-100 bg-violet-50 p-5 sm:flex sm:items-center sm:gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-violet-700 shadow-sm"><Link2 className="h-5 w-5" /></span><div className="mt-3 sm:mt-0"><h2 className="font-extrabold text-violet-950">حلقة سريرية واحدة، سجلات واضحة</h2><p className="mt-1 text-sm leading-6 text-violet-900/75">خزعة الكبد بتاريخ 7 يونيو 2021 مرتبطة بنتيجة علم الأمراض الصادرة في 10 يونيو 2021{oncologyVisit ? `، وزيارة ${oncologyVisit.department} بتاريخ ${formatMedicalDate(oncologyVisit.examDate)}.` : "."}</p></div></div><div className="mt-8"><p className="section-kicker">الخزعة والنتيجة</p><h2 className="section-title">تفاصيل الحلقة المرتبطة</h2></div><div className="mt-6 grid gap-4 md:grid-cols-2">{records.map((visit) => <RecordCard key={visit.id} visit={visit} linkedLabels={[visit.reportType.includes("علم الأمراض") ? "مرتبط بإجراء خزعة الكبد" : "مرتبط بنتيجة علم الأمراض", ...(oncologyLink ? [oncologyLink] : [])]} />)}</div></section></PortalShell>;
}

