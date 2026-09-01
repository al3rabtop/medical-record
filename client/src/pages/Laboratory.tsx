import { Link } from "wouter";
import { MedicalNotice, PortalShell } from "@/components/PortalShell";
import { PortalPageHeader } from "@/components/PortalPageHeader";
import { PortalError, PortalLoading } from "@/components/PortalState";
import { MetricCard } from "@/components/MetricCard";
import { MetricListView } from "@/components/MetricListView";
import { MetricHistoryDialog } from "@/components/MetricHistoryDialog";
import { MedicalStatusBadge } from "@/components/MedicalStatusBadge";
import { trpc } from "@/lib/trpc";
import { Activity, FlaskConical , LayoutGrid, List , FileDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useProfile } from "@/contexts/ProfileContext";
import { useLocale } from "@/contexts/LocaleContext";

const ALL_CATEGORIES = "__all__" as const;

export default function Laboratory() {
  const { profileId } = useProfile();
  const { t } = useLocale();
  const dashboard = trpc.medical.dashboard.useQuery(profileId ? { profileId } : undefined);
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORIES);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "follow_up" | "reassuring">("all");
  const [view, setView] = useState<"cards" | "list">(
    () => (typeof window !== "undefined" && window.sessionStorage.getItem("labView") === "list" ? "list" : "cards")
  );
  const setViewMode = (mode: "cards" | "list") => {
    setView(mode);
    if (typeof window !== "undefined") window.sessionStorage.setItem("labView", mode);
  };
  const [selectedMetricCode, setSelectedMetricCode] = useState<string | null>(null);
  const categories = useMemo(() => [ALL_CATEGORIES, ...Array.from(new Set((dashboard.data?.cards ?? []).map((card) => card.category)))], [dashboard.data?.cards]);
  if (dashboard.isLoading) return <PortalShell><PortalLoading /></PortalShell>;
  if (dashboard.error || !dashboard.data) return <PortalShell><PortalError /></PortalShell>;
  const data = dashboard.data;
  const q = query.trim().toLowerCase();
  const visibleCards = data.cards.filter((card) => {
    const categoryOk = activeCategory === ALL_CATEGORIES || card.category === activeCategory;
    const statusOk = statusFilter === "all" || card.status === statusFilter;
    const searchOk =
      q === "" ||
      card.label.toLowerCase().includes(q) ||
      (card.abbr ?? "").toLowerCase().includes(q);
    return categoryOk && statusOk && searchOk;
  });
  const selectedCard = data.cards.find((card) => card.code === selectedMetricCode) ?? null;
  const statusFilters = [
    { value: "all" as const, label: t.common.all },
    { value: "follow_up" as const, label: t.status.follow_up },
    { value: "reassuring" as const, label: t.status.reassuring },
  ];
  return <PortalShell><PortalPageHeader eyebrow={t.laboratory.eyebrow} title={t.laboratory.title} description={t.laboratory.description} Icon={FlaskConical} countLabel={t.laboratory.countLabel(data.portalCounts.laboratory, data.cards.length)} /><section className="container mt-8"><MedicalNotice /></section><section className="container mt-10"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="section-kicker">{t.laboratory.kicker}</p><h2 className="section-title">{t.laboratory.allIndicators}</h2><p className="mt-2 text-sm text-slate-600">{t.laboratory.cardHint}</p></div><Link href="/report" className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-600 transition hover:border-teal-300 hover:text-teal-800"><FileDown className="h-4 w-4" />{t.laboratory.exportLink}</Link><div className="flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white p-1"><button onClick={() => setViewMode("cards")} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${view === "cards" ? "bg-teal-800 text-white" : "text-slate-600 hover:bg-teal-50"}`}><LayoutGrid className="h-3.5 w-3.5" />{t.laboratory.cardsView}</button><button onClick={() => setViewMode("list")} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${view === "list" ? "bg-teal-800 text-white" : "text-slate-600 hover:bg-teal-50"}`}><List className="h-3.5 w-3.5" />{t.laboratory.listView}</button></div></div><div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center"><div className="relative flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.laboratory.searchPlaceholder} className="w-full rounded-full border border-slate-200 bg-white py-2 ps-9 pe-4 text-sm outline-none focus:border-teal-700" /></div><div className="flex shrink-0 gap-1.5">{statusFilters.map(({ value, label }) => <button key={value} onClick={() => setStatusFilter(value)} className={`rounded-full px-3 py-2 text-xs font-bold transition ${statusFilter === value ? "bg-teal-800 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>{label}</button>)}</div></div><div className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-1">{categories.map((category) => <button key={category} onClick={() => setActiveCategory(category)} className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-bold transition ${activeCategory === category ? "bg-teal-800 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-teal-200"}`}>{category === ALL_CATEGORIES ? t.common.all : (t.categoryLabels[category] ?? category)}</button>)}</div>{visibleCards.length === 0 ? <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500"><Activity className="mx-auto h-7 w-7" /><p className="mt-3 font-bold">{q ? t.laboratory.noSearchResults : t.laboratory.noIndicatorsInSection}</p></div> : view === "list" ? <div className="mt-6"><MetricListView cards={visibleCards} onOpen={setSelectedMetricCode} /></div> : <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visibleCards.map((card) => <MetricCard key={card.code} {...card} code={card.code} onOpenHistory={() => setSelectedMetricCode(card.code)} />)}</div>}<div className="mt-8 rounded-[1.45rem] border border-slate-200 bg-white p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="section-kicker">{t.laboratory.transparencyKicker}</p><h3 className="mt-1 text-xl font-extrabold text-slate-900">{t.laboratory.dataUnavailableTitle}</h3><p className="mt-1 text-sm text-slate-600">{t.laboratory.dataUnavailableDescription}</p></div><MedicalStatusBadge status="unavailable" /></div><div className="mt-5 grid gap-3 md:grid-cols-3">{t.laboratory.unavailableGaps.filter((item) => item.id !== "radiology").map((item) => <div key={item.id} className="rounded-xl bg-slate-50 px-4 py-3"><p className="font-bold text-slate-800">{item.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p></div>)}</div></div></section><MetricHistoryDialog open={selectedCard !== null} onOpenChange={(open) => { if (!open) setSelectedMetricCode(null); }} card={selectedCard} /></PortalShell>;
}
