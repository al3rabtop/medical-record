import { MedicalNotice, PortalShell } from "@/components/PortalShell";
import { PortalPageHeader } from "@/components/PortalPageHeader";
import { PortalError, PortalLoading } from "@/components/PortalState";
import { RecordCard } from "@/components/RecordCard";
import { trpc } from "@/lib/trpc";
import { Stethoscope } from "lucide-react";

export default function PhysicianReports() {
  const dashboard = trpc.medical.dashboard.useQuery();
  if (dashboard.isLoading) return <PortalShell><PortalLoading /></PortalShell>;
  if (dashboard.error || !dashboard.data) return <PortalShell><PortalError /></PortalShell>;
  const records = dashboard.data.visits.filter((visit) => visit.portal === "physician");
  const specialtyGroups = Object.entries(records.reduce<Record<string, typeof records>>((groups, visit) => {
    const specialty = visit.department || "تخصص غير مذكور";
    groups[specialty] = [...(groups[specialty] ?? []), visit];
    return groups;
  }, {}));
  return <PortalShell><PortalPageHeader eyebrow="بوابة تقارير الأطباء" title="الزيارات والتقييم والخطة" description="كل تقرير طبي يظهر ضمن تخصصه، مع الطبيب وتاريخ الزيارة ومقتطف من الخطة كما ورد في المصدر." Icon={Stethoscope} countLabel={`${records.length} تقارير أطباء`} /><section className="container mt-8"><MedicalNotice /></section><section className="container mt-10"><div><p className="section-kicker">التقارير الطبية</p><h2 className="section-title">منظمة حسب التخصص</h2><p className="mt-2 text-sm text-slate-600">يفتح التقرير المنظم سبب الزيارة والتقييم والخطة كما نُقلت من المصدر.</p></div><div className="mt-6 space-y-8">{specialtyGroups.map(([specialty, specialtyRecords]) => <section key={specialty} className="rounded-[1.7rem] border border-slate-200 bg-slate-50/70 p-4 sm:p-6"><div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="section-kicker">التخصص</p><h3 className="mt-1 text-xl font-extrabold text-slate-950">{specialty}</h3></div><span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-teal-800 shadow-sm">{specialtyRecords.length} تقرير</span></div><div className="mt-4 rounded-xl border border-teal-100 bg-teal-50/70 p-4"><p className="text-xs font-extrabold text-teal-800">مقتطف الخطة/المتابعة من المصدر</p><p className="mt-2 line-clamp-3 text-sm leading-6 text-teal-950/80">{specialtyRecords[0]?.summary ?? "لا توجد خطة نصية متاحة في التقرير."}</p></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{specialtyRecords.map((visit) => <RecordCard key={visit.id} visit={visit} />)}</div></section>)}{!records.length && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">لا توجد تقارير أطباء مسجلة.</p>}</div></section></PortalShell>;
}
