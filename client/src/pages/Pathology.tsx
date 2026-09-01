import { MedicalNotice, PortalShell } from "@/components/PortalShell";
import { PortalPageHeader } from "@/components/PortalPageHeader";
import { PortalError, PortalLoading } from "@/components/PortalState";
import { RecordCard } from "@/components/RecordCard";
import { formatMedicalDate } from "@/lib/medical-ui";
import { trpc } from "@/lib/trpc";
import { Dna, Link2 } from "lucide-react";
import { EmptyPortal } from "@/components/EmptyPortal";
import { useProfile } from "@/contexts/ProfileContext";
import { useLocale } from "@/contexts/LocaleContext";

export default function Pathology() {
  const { profileId } = useProfile();
  const { t, locale } = useLocale();
  const dashboard = trpc.medical.dashboard.useQuery(profileId ? { profileId } : undefined);
  if (dashboard.isLoading) return <PortalShell><PortalLoading /></PortalShell>;
  if (dashboard.error || !dashboard.data) return <PortalShell><PortalError /></PortalShell>;
  const records = dashboard.data.visits.filter((visit) => visit.portal === "pathology").sort((a, b) => Number(a.reportType.includes("علم الأمراض")) - Number(b.reportType.includes("علم الأمراض")));
  const oncologyVisit = dashboard.data.visits.find((visit) => visit.portal === "physician" && visit.department === "الأورام");
  const oncologyLink = oncologyVisit ? t.pathology.linkedToVisit(oncologyVisit.department!, formatMedicalDate(oncologyVisit.examDate, locale)) : null;
  const narrative = oncologyVisit
    ? t.pathology.narrativeWithOncology(oncologyVisit.department!, formatMedicalDate(oncologyVisit.examDate, locale))
    : t.pathology.narrativeWithoutOncology;

  return <PortalShell><PortalPageHeader eyebrow={t.pathology.eyebrow} title={t.pathology.title} description={t.pathology.description} Icon={Dna} countLabel={t.pathology.countLabel(records.length)} /><section className="container mt-8"><MedicalNotice /></section><section className="container mt-10"><div className="rounded-[1.5rem] border border-violet-100 bg-violet-50 p-5 sm:flex sm:items-center sm:gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-violet-700 shadow-sm"><Link2 className="h-5 w-5" /></span><div className="mt-3 sm:mt-0"><h2 className="font-extrabold text-violet-950">{t.pathology.oneClinicalLoopTitle}</h2><p className="mt-1 text-sm leading-6 text-violet-900/75">{narrative}</p></div></div><div className="mt-8"><p className="section-kicker">{t.pathology.kicker}</p><h2 className="section-title">{t.pathology.detailsTitle}</h2></div><div className="mt-6 grid gap-4 md:grid-cols-2">{records.map((visit) => <RecordCard key={visit.id} visit={visit} linkedLabels={[visit.reportType.includes("علم الأمراض") ? t.pathology.linkedToBiopsy : t.pathology.linkedToPathologyResult, ...(oncologyLink ? [oncologyLink] : [])]} />)}</div></section></PortalShell>;
}
