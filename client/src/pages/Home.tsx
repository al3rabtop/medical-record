import { MedicalNotice, PortalShell } from "@/components/PortalShell";
import { PortalError, PortalLoading } from "@/components/PortalState";
import { trpc } from "@/lib/trpc";
import { formatMedicalDate } from "@/lib/medical-ui";
import { getLocalizedTestName } from "@shared/testInfo";
import { ArrowLeft, CircleAlert, Clock3, Dna, FlaskConical, History, ScanLine, Sparkles, Stethoscope } from "lucide-react";
import { Link } from "wouter";
import { useProfile } from "@/contexts/ProfileContext";
import { useLocale } from "@/contexts/LocaleContext";
import { Bell } from "lucide-react";

export default function Home() {
  const { profileId } = useProfile();
  const { t, locale } = useLocale();
  const dashboard = trpc.medical.dashboard.useQuery(profileId ? { profileId } : undefined);
  const reminders = trpc.medical.reminders.useQuery(profileId ? { profileId } : undefined);
  if (dashboard.isLoading) return <PortalShell><PortalLoading /></PortalShell>;
  if (dashboard.error || !dashboard.data) return <PortalShell><PortalError /></PortalShell>;

  const data = dashboard.data;
  const portals = [
    { href: "/labs", label: t.home.portals.laboratory.label, count: data.portalCounts.laboratory, latest: data.portalLatest.laboratory, detail: t.home.portals.laboratory.detail(data.cards.length), Icon: FlaskConical, accent: "bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300" },
    { href: "/radiology", label: t.home.portals.radiology.label, count: data.portalCounts.radiology, latest: data.portalLatest.radiology, detail: t.home.portals.radiology.detail, Icon: ScanLine, accent: "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300" },
    { href: "/physician-reports", label: t.home.portals.physician.label, count: data.portalCounts.physician, latest: data.portalLatest.physician, detail: t.home.portals.physician.detail, Icon: Stethoscope, accent: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" },
    { href: "/pathology", label: t.home.portals.pathology.label, count: data.portalCounts.pathology, latest: data.portalLatest.pathology, detail: t.home.portals.pathology.detail, Icon: Dna, accent: "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300" },
  ];

  return (
    <PortalShell>
      <section className="container pt-8 sm:pt-12">
        <div className="medical-hero relative overflow-hidden rounded-[2rem] bg-teal-950 px-6 py-9 text-white shadow-[0_28px_60px_-34px_rgba(6,78,59,0.95)] sm:px-10 sm:py-12">
          <div className="hero-orb hero-orb-one" /><div className="hero-orb hero-orb-two" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_310px] lg:items-end">
            <div className="max-w-2xl"><div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-teal-50"><Sparkles className="h-3.5 w-3.5 text-amber-300" />{t.home.heroKicker}</div><h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{t.home.heroTitleLine1}<br /><span className="text-teal-200">{t.home.heroTitleLine2}</span></h1><p className="mt-4 max-w-xl text-sm leading-7 text-teal-50/80 sm:text-base">{t.home.heroDescription}</p></div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/10 p-5 backdrop-blur-sm"><div className="flex items-center gap-2 text-xs font-bold text-teal-100/80"><Clock3 className="h-4 w-4" />{t.home.lastUpdated}</div><p className="mt-3 text-xl font-extrabold">{data.latestVisit ? formatMedicalDate(data.latestVisit.examDate, locale) : t.home.noVisitsYet}</p><p className="mt-1 text-sm text-teal-100/75">{data.latestVisit?.reportType ?? t.home.awaitingFirstReport}</p></div>
          </div>
        </div>
      </section>
      <section className="container mt-8"><MedicalNotice /></section>
      {reminders.data && reminders.data.length > 0 && (
        <section className="container mt-6">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 sm:p-6">
            <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
              <Bell className="h-4 w-4 text-teal-700" />
              {t.home.followUpReminders}
            </h3>
            <div className="mt-4 flex flex-col gap-2">
              {reminders.data.map(r => (
                <Link
                  key={r.resultId}
                  href="/labs"
                  className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm transition hover:opacity-80 ${
                    r.overdue ? "bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200" : "bg-teal-50 text-teal-900 dark:bg-teal-950/40 dark:text-teal-200"
                  }`}
                >
                  <span className="min-w-0 truncate font-bold">{getLocalizedTestName(r.code, locale, r.label)}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {r.overdue && (
                      <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-extrabold text-amber-900 dark:bg-amber-800/60 dark:text-amber-200">{t.home.overdue}</span>
                    )}
                    <span dir="ltr" className="font-bold">{r.followUpDate}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
      <section className="container mt-12">
        <div><p className="section-kicker">{t.home.portalsKicker}</p><h2 className="section-title">{t.home.choosePortalTitle}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{t.home.choosePortalDescription}</p></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {portals.map(({ href, label, count, latest, detail, Icon, accent }) => <Link key={href} href={href} className="group rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-[0_14px_40px_-30px_rgba(15,71,63,0.7)] transition hover:-translate-y-1 hover:border-teal-200 hover:shadow-[0_24px_45px_-28px_rgba(15,71,63,0.55)]"><div className="flex items-start justify-between gap-4"><span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accent}`}><Icon className="h-6 w-6" /></span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600">{count} {t.home.recordsSuffix}</span></div><h3 className="mt-6 text-xl font-extrabold text-slate-950">{label}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p><div className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600"><span className="font-extrabold text-teal-800">{t.home.lastRecord} </span>{latest ? `${formatMedicalDate(latest.examDate, locale)} · ${latest.reportType}` : t.home.noRecords}</div><div className="mt-4 flex items-center gap-1 text-sm font-extrabold text-teal-800">{t.home.openPortal} <ArrowLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180 transition group-hover:-translate-x-1 rtl:group-hover:-translate-x-1 ltr:group-hover:translate-x-1" /></div></Link>)}
        </div>
        <Link href="/timeline" className="mt-5 flex flex-col gap-4 rounded-[1.5rem] bg-teal-950 p-6 text-white transition hover:bg-teal-900 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-teal-200"><History className="h-5 w-5" /></span><div><h3 className="font-extrabold">{t.home.fullTimeline}</h3><p className="mt-1 text-sm text-slate-300">{t.home.fullTimelineDescription}</p></div></div><div className="flex flex-col gap-1 text-start"><span className="text-sm font-extrabold text-teal-200">{t.timeline.countLabel(data.visits.length)}</span><span className="text-xs text-slate-300"><strong className="text-teal-100">{t.home.lastRecord} </strong>{data.latestVisit ? `${formatMedicalDate(data.latestVisit.examDate, locale)} · ${data.latestVisit.reportType}` : t.home.noRecords}</span></div></Link>
      </section>
      <section className="container mt-12 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"><div><p className="section-kicker">{t.home.followUpSummaryKicker}</p><h2 className="section-title">{t.home.followUpSummaryTitle}</h2><div className="mt-5 grid gap-3">{data.followUp.slice(0, 3).map((item) => <div key={item.code} className="rounded-2xl border border-amber-100 bg-white p-4 dark:border-amber-900/40"><div className="flex items-center justify-between gap-3"><h3 className="min-w-0 break-words font-extrabold text-slate-900">{getLocalizedTestName(item.code, locale, item.label)}</h3><span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{t.status.follow_up}</span></div><p className="mt-2 text-sm text-slate-600">{t.home.latestResultPrefix} {item.value} · {t.interpretation[item.interpretation.key].label}</p></div>)}</div></div><aside className="rounded-[1.6rem] border border-teal-100 bg-[#eff8f5] p-6 dark:border-teal-900/50 dark:bg-teal-950/30"><CircleAlert className="h-5 w-5 text-teal-800 dark:text-teal-300" /><h2 className="mt-4 text-xl font-extrabold text-teal-950 dark:text-teal-100">{t.home.organizeBeforeInterpretTitle}</h2><p className="mt-3 text-sm leading-7 text-teal-900/75 dark:text-teal-200/80">{t.home.organizeBeforeInterpretBody}</p></aside></section>
    </PortalShell>
  );
}
