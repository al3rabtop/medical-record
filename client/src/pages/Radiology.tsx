import { MedicalNotice, PortalShell } from "@/components/PortalShell";
import { PortalPageHeader } from "@/components/PortalPageHeader";
import { PortalError, PortalLoading } from "@/components/PortalState";
import { RecordCard } from "@/components/RecordCard";
import { trpc } from "@/lib/trpc";
import { useLocale } from "@/contexts/LocaleContext";
import type { RadiologyModality } from "@shared/medical";
import { ScanLine } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyPortal } from "@/components/EmptyPortal";
import { useProfile } from "@/contexts/ProfileContext";

const ALL = "__all__" as const;

export default function Radiology() {
  const { profileId } = useProfile();
  const { t } = useLocale();
  const dashboard = trpc.medical.dashboard.useQuery(profileId ? { profileId } : undefined);
  const [activeModality, setActiveModality] = useState<typeof ALL | RadiologyModality>(ALL);
  const records = useMemo(() => (dashboard.data?.visits ?? []).filter((visit) => visit.portal === "radiology"), [dashboard.data?.visits]);
  const modalities = useMemo(() => Array.from(new Set(records.map((visit) => visit.modality).filter((item): item is RadiologyModality => item !== null))), [records]);
  if (dashboard.isLoading) return <PortalShell><PortalLoading /></PortalShell>;
  if (dashboard.error || !dashboard.data) return <PortalShell><PortalError /></PortalShell>;
  const visibleRecords = records.filter((visit) => activeModality === ALL || visit.modality === activeModality);
  return <PortalShell><PortalPageHeader eyebrow={t.radiology.eyebrow} title={t.radiology.title} description={t.radiology.description} Icon={ScanLine} countLabel={t.radiology.countLabel(records.length)} /><section className="container mt-8"><MedicalNotice /></section><section className="container mt-10"><div><p className="section-kicker">{t.radiology.kicker}</p><h2 className="section-title">{t.radiology.chooseModality}</h2><p className="mt-2 text-sm text-slate-600">{t.radiology.cardHint}</p></div><div className="mt-5 flex gap-2 overflow-x-auto pb-2"><button onClick={() => setActiveModality(ALL)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${activeModality === ALL ? "bg-teal-800 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{t.common.all} · {records.length}</button>{modalities.map((modality) => <button key={modality} onClick={() => setActiveModality(modality)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${activeModality === modality ? "bg-teal-800 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{t.modality[modality]} · {records.filter((item) => item.modality === modality).length}</button>)}</div><div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleRecords.map((visit) => <RecordCard key={visit.id} visit={visit} />)}{!visibleRecords.length && <EmptyPortal Icon={ScanLine} title={t.radiology.emptyTitle} hint={t.radiology.emptyHint} />}</div></section></PortalShell>;
}
