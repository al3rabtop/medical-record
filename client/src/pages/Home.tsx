import { MedicalNotice, PortalShell } from "@/components/PortalShell";
import { PortalError, PortalLoading } from "@/components/PortalState";
import { trpc } from "@/lib/trpc";
import { formatMedicalDate } from "@/lib/medical-ui";
import { ArrowLeft, CircleAlert, Clock3, Dna, FlaskConical, History, ScanLine, Sparkles, Stethoscope } from "lucide-react";
import { Link } from "wouter";
import { useProfile } from "@/contexts/ProfileContext";

export default function Home() {
  const { profileId } = useProfile();
  const dashboard = trpc.medical.dashboard.useQuery(profileId ? { profileId } : undefined);
  if (dashboard.isLoading) return <PortalShell><PortalLoading /></PortalShell>;
  if (dashboard.error || !dashboard.data) return <PortalShell><PortalError /></PortalShell>;

  const data = dashboard.data;
  const portals = [
    { href: "/labs", label: "التحاليل", count: data.portalCounts.laboratory, latest: data.portalLatest.laboratory, detail: `${data.cards.length} مؤشراً قابلاً للعرض`, Icon: FlaskConical, accent: "bg-violet-50 text-violet-800" },
    { href: "/radiology", label: "الأشعة", count: data.portalCounts.radiology, latest: data.portalLatest.radiology, detail: "CT، MRI، X-ray والتصوير التألقي", Icon: ScanLine, accent: "bg-sky-50 text-sky-800" },
    { href: "/physician-reports", label: "تقارير الأطباء", count: data.portalCounts.physician, latest: data.portalLatest.physician, detail: "الزيارات والتقييم والخطة", Icon: Stethoscope, accent: "bg-emerald-50 text-emerald-800" },
    { href: "/pathology", label: "الخزعات وعلم الأمراض", count: data.portalCounts.pathology, latest: data.portalLatest.pathology, detail: "الإجراء والنتيجة النسيجية المرتبطة", Icon: Dna, accent: "bg-rose-50 text-rose-800" },
  ];

  return (
    <PortalShell>
      <section className="container pt-8 sm:pt-12">
        <div className="medical-hero relative overflow-hidden rounded-[2rem] bg-teal-950 px-6 py-9 text-white shadow-[0_28px_60px_-34px_rgba(6,78,59,0.95)] sm:px-10 sm:py-12">
          <div className="hero-orb hero-orb-one" /><div className="hero-orb hero-orb-two" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_310px] lg:items-end">
            <div className="max-w-2xl"><div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-teal-50"><Sparkles className="h-3.5 w-3.5 text-amber-300" />خمس بوابات، سجل واحد</div><h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">كل نوع من السجلات<br /><span className="text-teal-200">في مكانه الصحيح.</span></h1><p className="mt-4 max-w-xl text-sm leading-7 text-teal-50/80 sm:text-base">ابدأ من البوابة المناسبة: التحاليل للقياسات، الأشعة للدراسات التصويرية، تقارير الأطباء للزيارات، والخزعات لعلم الأمراض.</p></div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/10 p-5 backdrop-blur-sm"><div className="flex items-center gap-2 text-xs font-bold text-teal-100/80"><Clock3 className="h-4 w-4" />آخر تحديث في السجل</div><p className="mt-3 text-xl font-extrabold">{data.latestVisit ? formatMedicalDate(data.latestVisit.examDate) : "لا توجد زيارات"}</p><p className="mt-1 text-sm text-teal-100/75">{data.latestVisit?.reportType ?? "بانتظار أول تقرير"}</p></div>
          </div>
        </div>
      </section>
      <section className="container mt-8"><MedicalNotice /></section>
      <section className="container mt-12">
        <div><p className="section-kicker">بوابات السجل</p><h2 className="section-title">اختر ما تريد مراجعته</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">لم تعد التقارير مخفية داخل قائمة واحدة؛ لكل نوع بوابة مستقلة وتصنيف واضح.</p></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {portals.map(({ href, label, count, latest, detail, Icon, accent }) => <Link key={href} href={href} className="group rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-[0_14px_40px_-30px_rgba(15,71,63,0.7)] transition hover:-translate-y-1 hover:border-teal-200 hover:shadow-[0_24px_45px_-28px_rgba(15,71,63,0.55)]"><div className="flex items-start justify-between gap-4"><span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accent}`}><Icon className="h-6 w-6" /></span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600">{count} سجلات</span></div><h3 className="mt-6 text-xl font-extrabold text-slate-950">{label}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p><div className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600"><span className="font-extrabold text-teal-800">آخر سجل: </span>{latest ? `${formatMedicalDate(latest.examDate)} · ${latest.reportType}` : "لا توجد سجلات"}</div><div className="mt-4 flex items-center gap-1 text-sm font-extrabold text-teal-800">فتح البوابة <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" /></div></Link>)}
        </div>
        <Link href="/timeline" className="mt-5 flex flex-col gap-4 rounded-[1.5rem] bg-slate-900 p-6 text-white transition hover:bg-slate-800 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-teal-200"><History className="h-5 w-5" /></span><div><h3 className="font-extrabold">السجل الزمني الشامل</h3><p className="mt-1 text-sm text-slate-300">كل الزيارات والتقارير مرتبة حسب تاريخ الفحص.</p></div></div><div className="flex flex-col gap-1 text-right sm:text-left"><span className="text-sm font-extrabold text-teal-200">{data.visits.length} زيارة وسجلاً</span><span className="text-xs text-slate-300"><strong className="text-teal-100">آخر سجل: </strong>{data.latestVisit ? `${formatMedicalDate(data.latestVisit.examDate)} · ${data.latestVisit.reportType}` : "لا توجد سجلات"}</span></div></Link>
      </section>
      <section className="container mt-12 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"><div><p className="section-kicker">ملخص المتابعة</p><h2 className="section-title">أبرز المؤشرات الحالية</h2><div className="mt-5 grid gap-3">{data.followUp.slice(0, 3).map((item) => <div key={item.code} className="rounded-2xl border border-amber-100 bg-white p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-extrabold text-slate-900">{item.label}</h3><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">يحتاج متابعة</span></div><p className="mt-2 text-sm text-slate-600">أحدث نتيجة: {item.value} · {item.interpretation.label}</p></div>)}</div></div><aside className="rounded-[1.6rem] border border-teal-100 bg-[#eff8f5] p-6"><CircleAlert className="h-5 w-5 text-teal-800" /><h2 className="mt-4 text-xl font-extrabold text-teal-950">التنظيم قبل التفسير</h2><p className="mt-3 text-sm leading-7 text-teal-900/75">وجود التقرير في بوابته المناسبة يجعل الوصول إليه أوضح، لكنه لا يحول محتواه إلى تشخيص جديد. تبقى صياغة المصدر والسياق الطبي هما المرجع.</p></aside></section>
    </PortalShell>
  );
}
