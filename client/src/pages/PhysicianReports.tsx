import { MedicalNotice, PortalShell } from "@/components/PortalShell";
import { PortalPageHeader } from "@/components/PortalPageHeader";
import { PortalError, PortalLoading } from "@/components/PortalState";
import { RecordCard } from "@/components/RecordCard";
import { trpc } from "@/lib/trpc";
import { Stethoscope } from "lucide-react";
import { EmptyPortal } from "@/components/EmptyPortal";
import { useProfile } from "@/contexts/ProfileContext";
import { useLocale } from "@/contexts/LocaleContext";

export default function PhysicianReports() {
  const { profileId } = useProfile();
  const { t } = useLocale();
  const dashboard = trpc.medical.dashboard.useQuery(profileId ? { profileId } : undefined);
  if (dashboard.isLoading) return <PortalShell><PortalLoading /></PortalShell>;
  if (dashboard.error || !dashboard.data) return <PortalShell><PortalError /></PortalShell>;
  const records = dashboard.data.visits.filter((visit) => visit.portal === "physician");
  const specialtyGroups = Object.entries(records.reduce<Record<string, typeof records>>((groups, visit) => {
    const specialty = visit.department || t.physicianReports.specialtyNotMentioned;
    groups[specialty] = [...(groups[specialty] ?? []), visit];
    return groups;
  }, {}));
  return <PortalShell><PortalPageHeader eyebrow={t.physicianReports.eyebrow} title={t.physicianReports.title} description={t.physicianReports.description} Icon={Stethoscope} countLabel={t.physicianReports.countLabel(records.length)} /><section className="container mt-8"><MedicalNotice /></section><section className="container mt-10"><div><p className="section-kicker">{t.physicianReports.kicker}</p><h2 className="section-title">{t.physicianReports.organizedBySpecialty}</h2><p className="mt-2 text-sm text-slate-600">{t.physicianReports.subDescription}</p></div><div className="mt-6 space-y-8">{specialtyGroups.map(([specialty, specialtyRecords]) => <section key={specialty} className="rounded-[1.7rem] border border-slate-200 bg-slate-50/70 p-4 sm:p-6"><div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="section-kicker">{t.physicianReports.specialtyLabel}</p><h3 className="mt-1 text-xl font-extrabold text-slate-950">{t.departmentLabels[specialty] ?? specialty}</h3></div><span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-teal-800 shadow-sm">{t.physicianReports.reportSuffix(specialtyRecords.length)}</span></div><div className="mt-4 rounded-xl border border-teal-100 bg-teal-50/70 p-4 dark:border-teal-900/50 dark:bg-teal-950/30"><p className="text-xs font-extrabold text-teal-800 dark:text-teal-300">{t.physicianReports.planExcerptTitle}</p><p className="mt-2 line-clamp-3 text-sm leading-6 text-teal-950/80 dark:text-teal-200/80">{specialtyRecords[0]?.summary ?? t.physicianReports.noPlanAvailable}</p></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{specialtyRecords.map((visit) => <RecordCard key={visit.id} visit={visit} />)}</div></section>)}{!records.length && <EmptyPortal Icon={Stethoscope} title={t.physicianReports.emptyTitle} hint={t.physicianReports.emptyHint} />}</div></section></PortalShell>;
}
