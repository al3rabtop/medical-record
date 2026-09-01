import { MedicalNotice, PortalShell } from "@/components/PortalShell";
import { PortalPageHeader } from "@/components/PortalPageHeader";
import { PortalError, PortalLoading } from "@/components/PortalState";
import { RecordCard } from "@/components/RecordCard";
import { portalLabels } from "@/lib/medical-ui";
import { trpc } from "@/lib/trpc";
import type { RecordPortal } from "@shared/medical";
import { History } from "lucide-react";
import { useState } from "react";
import { useProfile } from "@/contexts/ProfileContext";

export default function Timeline() {
  const { profileId } = useProfile();
  const dashboard = trpc.medical.dashboard.useQuery(profileId ? { profileId } : undefined);
  const [activePortal, setActivePortal] = useState<"all" | RecordPortal>("all");
  if (dashboard.isLoading) return <PortalShell><PortalLoading /></PortalShell>;
  if (dashboard.error || !dashboard.data) return <PortalShell><PortalError /></PortalShell>;
  const records = dashboard.data.visits.filter((visit) => activePortal === "all" || visit.portal === activePortal);
  const portals = Object.keys(portalLabels) as RecordPortal[];
  return <PortalShell><PortalPageHeader eyebrow="العرض الشامل" title="السجل الزمني لجميع الأحداث" description="يعرض كل الزيارات والتقارير من الأحدث إلى الأقدم، مع بقاء كل سجل تابعاً لبوابته الصحيحة." Icon={History} countLabel={`${dashboard.data.visits.length} زيارة وسجلاً`} /><section className="container mt-8"><MedicalNotice /></section><section className="container mt-10"><div className="flex gap-2 overflow-x-auto pb-2"><button onClick={() => setActivePortal("all")} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${activePortal === "all" ? "bg-teal-800 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>الكل · {dashboard.data.visits.length}</button>{portals.map((portal) => <button key={portal} onClick={() => setActivePortal(portal)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${activePortal === portal ? "bg-teal-800 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{portalLabels[portal]} · {dashboard.data.visits.filter((item) => item.portal === portal).length}</button>)}</div><div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{records.map((visit) => <RecordCard key={visit.id} visit={visit} />)}</div></section></PortalShell>;
}
