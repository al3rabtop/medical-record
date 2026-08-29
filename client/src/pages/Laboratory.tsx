import { MedicalNotice, PortalShell } from "@/components/PortalShell";
import { PortalPageHeader } from "@/components/PortalPageHeader";
import { PortalError, PortalLoading } from "@/components/PortalState";
import { MetricCard } from "@/components/MetricCard";
import { MetricHistoryDialog } from "@/components/MetricHistoryDialog";
import { MedicalStatusBadge } from "@/components/MedicalStatusBadge";
import { trpc } from "@/lib/trpc";
import { Activity, FlaskConical } from "lucide-react";
import { useMemo, useState } from "react";

export default function Laboratory() {
  const dashboard = trpc.medical.dashboard.useQuery();
  const [activeCategory, setActiveCategory] = useState("الكل");
  const [selectedMetricCode, setSelectedMetricCode] = useState<string | null>(null);
  const categories = useMemo(() => ["الكل", ...Array.from(new Set((dashboard.data?.cards ?? []).map((card) => card.category)))], [dashboard.data?.cards]);
  if (dashboard.isLoading) return <PortalShell><PortalLoading /></PortalShell>;
  if (dashboard.error || !dashboard.data) return <PortalShell><PortalError /></PortalShell>;
  const data = dashboard.data;
  const visibleCards = data.cards.filter((card) => activeCategory === "الكل" || card.category === activeCategory);
  const selectedCard = data.cards.find((card) => card.code === selectedMetricCode) ?? null;
  return <PortalShell><PortalPageHeader eyebrow="بوابة التحاليل" title="القياسات والنتائج عبر الوقت" description="هذه البوابة مخصصة للنتائج الرقمية القابلة للمقارنة، مع آخر خمس قراءات والسجل الكامل لكل مؤشر." Icon={FlaskConical} countLabel={`${data.portalCounts.laboratory} زيارات مختبر · ${data.cards.length} مؤشراً`} /><section className="container mt-8"><MedicalNotice /></section><section className="container mt-10"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="section-kicker">نتائج المختبر</p><h2 className="section-title">جميع المؤشرات</h2><p className="mt-2 text-sm text-slate-600">اضغط على أي بطاقة لعرض كل نتائجها السابقة.</p></div><div className="flex max-w-full gap-2 overflow-x-auto pb-1">{categories.map((category) => <button key={category} onClick={() => setActiveCategory(category)} className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-bold transition ${activeCategory === category ? "bg-teal-800 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-teal-200"}`}>{category}</button>)}</div></div><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visibleCards.map((card) => <MetricCard key={card.code} {...card} onOpenHistory={() => setSelectedMetricCode(card.code)} />)}{!visibleCards.length && <div className="col-span-full rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500"><Activity className="mx-auto h-7 w-7" /><p className="mt-3 font-bold">لا توجد مؤشرات ضمن هذا القسم.</p></div>}</div><div className="mt-8 rounded-[1.45rem] border border-slate-200 bg-white p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="section-kicker">شفافية السجل</p><h3 className="mt-1 text-xl font-extrabold text-slate-900">بيانات غير متوفرة حالياً</h3><p className="mt-1 text-sm text-slate-600">هذه فجوات معلنة في الملفات، وليست نتائج سلبية.</p></div><MedicalStatusBadge status="unavailable" /></div><div className="mt-5 grid gap-3 md:grid-cols-3">{data.unavailable.filter((item) => item.label !== "الأشعة").map((item) => <div key={item.label} className="rounded-xl bg-slate-50 px-4 py-3"><p className="font-bold text-slate-800">{item.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p></div>)}</div></div></section><MetricHistoryDialog open={selectedCard !== null} onOpenChange={(open) => { if (!open) setSelectedMetricCode(null); }} card={selectedCard} /></PortalShell>;
}
