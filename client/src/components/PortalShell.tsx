import { HeartPulse, Home, FlaskConical, ScanLine, Stethoscope, Dna, History, ShieldCheck, LogOut, FilePlus2, Shield, Settings } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { ProfileSwitcher } from "@/components/ProfileSwitcher";
import { useProfile } from "@/contexts/ProfileContext";
import { useLocale } from "@/contexts/LocaleContext";
import { LocaleThemeSwitcher } from "@/components/LocaleThemeSwitcher";
import type { Dictionary } from "@/i18n";

function useNavigation(t: Dictionary) {
  return [
    { href: "/", label: t.nav.home, Icon: Home },
    { href: "/labs", label: t.nav.labs, Icon: FlaskConical },
    { href: "/radiology", label: t.nav.radiology, Icon: ScanLine },
    { href: "/physician-reports", label: t.nav.physicianReports, Icon: Stethoscope },
    { href: "/pathology", label: t.nav.pathology, Icon: Dna },
    { href: "/timeline", label: t.nav.timeline, Icon: History },
    { href: "/upload", label: t.nav.upload, Icon: FilePlus2 },
  ];
}

async function handleLogout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

export function PortalShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const me = trpc.auth.me.useQuery();
  const patientName = me.data?.patientName ?? null;
  const isAdmin = me.data?.role === "admin";
  const { activeProfile } = useProfile();
  const { t, dir } = useLocale();
  const navigation = useNavigation(t);
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground" dir={dir}>
      <header className="sticky top-0 z-40 border-b border-white/80 bg-background/95 backdrop-blur-xl dark:border-slate-800">
        <div className="container flex h-[4.75rem] items-center justify-between gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-teal-700">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-800 text-white shadow-[0_8px_20px_-8px_rgba(15,118,110,0.8)]"><HeartPulse className="h-5 w-5" /></span>
            <span><span className="block text-base font-extrabold tracking-tight text-teal-950 dark:text-teal-300">{t.app.name}</span>{(activeProfile?.name ?? patientName) && <span className="block text-[10px] font-bold tracking-[0.08em] text-teal-700 dark:text-teal-400">{activeProfile?.name ?? patientName}</span>}</span>
          </Link>
          <nav className="hidden items-center gap-1 rounded-full border border-slate-200 bg-white/80 p-1 lg:flex dark:bg-slate-900/80" aria-label={t.nav.portalsLabel}>
            {navigation.map(({ href, label, Icon }) => {
              const active = href === "/" ? location === "/" : location.startsWith(href);
              return <Link key={href} href={href} className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition ${active ? "bg-teal-800 text-white shadow-sm" : "text-slate-600 hover:bg-teal-50 hover:text-teal-900 dark:hover:bg-teal-950/40 dark:hover:text-teal-300"}`}><Icon className="h-3.5 w-3.5" />{label}</Link>;
            })}
          </nav>
          <div className="hidden items-center gap-2 sm:flex">
            <ProfileSwitcher />
            <LocaleThemeSwitcher />
            <Link href="/upload" className="flex items-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-900"><FilePlus2 className="h-4 w-4" />{t.nav.upload}</Link>
            <Link href="/settings" className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50" title={t.nav.settings}><Settings className="h-4 w-4" /></Link>{isAdmin && <Link href="/admin" className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50" title={t.nav.admin}><Shield className="h-4 w-4" /></Link>}<button onClick={handleLogout} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50" title={t.nav.logout}><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="container flex flex-wrap items-center gap-2 pb-2 lg:hidden"><ProfileSwitcher /><LocaleThemeSwitcher /></div><nav className="container flex gap-2 overflow-x-auto pb-3 lg:hidden" aria-label={t.nav.portalsLabelMobile}>
          {navigation.map(({ href, label, Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return <Link key={href} href={href} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold ${active ? "bg-teal-800 text-white" : "border border-slate-200 bg-white text-slate-600"}`}><Icon className="h-3.5 w-3.5" />{label}</Link>;
          })}
          <Link href="/settings" className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600"><Settings className="h-3.5 w-3.5" />{t.nav.settings}</Link>{isAdmin && <Link href="/admin" className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600"><Shield className="h-3.5 w-3.5" />{t.nav.admin}</Link>}<button onClick={handleLogout} className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600"><LogOut className="h-3.5 w-3.5" />{t.nav.logout}</button>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="mt-16 border-t border-slate-200 bg-white"><div className="container flex flex-col gap-2 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between"><p>{t.footer.tagline}</p><p className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> {t.footer.disclaimer}</p></div></footer>
    </div>
  );
}

export function MedicalNotice() {
  const { t } = useLocale();
  return <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 sm:flex sm:items-center sm:gap-4 sm:p-5 dark:border-sky-900/50 dark:bg-sky-950/30"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-sky-700 shadow-sm dark:text-sky-300"><ShieldCheck className="h-5 w-5" /></span><p className="mt-3 text-sm leading-6 text-slate-700 sm:mt-0"><strong className="text-slate-900">{t.notice.title}</strong> {t.notice.body}</p></div>;
}
