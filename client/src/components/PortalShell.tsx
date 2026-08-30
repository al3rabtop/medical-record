import { HeartPulse, Home, FlaskConical, ScanLine, Stethoscope, Dna, History, ShieldCheck, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { ReactNode } from "react";

const navigation = [
  { href: "/", label: "الرئيسية", Icon: Home },
  { href: "/labs", label: "التحاليل", Icon: FlaskConical },
  { href: "/radiology", label: "الأشعة", Icon: ScanLine },
  { href: "/physician-reports", label: "تقارير الأطباء", Icon: Stethoscope },
  { href: "/pathology", label: "الخزعات وعلم الأمراض", Icon: Dna },
  { href: "/timeline", label: "السجل الزمني", Icon: History },
];

async function handleLogout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

export function PortalShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7f9f7] text-slate-900" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-white/80 bg-[#f7f9f7]/95 backdrop-blur-xl">
        <div className="container flex h-[4.75rem] items-center justify-between gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-teal-700">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-800 text-white shadow-[0_8px_20px_-8px_rgba(15,118,110,0.8)]"><HeartPulse className="h-5 w-5" /></span>
            <span><span className="block text-base font-extrabold tracking-tight text-teal-950">رفيق الصحة</span><span className="block text-[10px] font-bold tracking-[0.08em] text-teal-700">أميرة محمد علي الهسي</span></span>
          </Link>
          <nav className="hidden items-center gap-1 rounded-full border border-slate-200 bg-white/80 p-1 lg:flex" aria-label="بوابات السجل">
            {navigation.map(({ href, label, Icon }) => {
              const active = href === "/" ? location === "/" : location.startsWith(href);
              return <Link key={href} href={href} className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition ${active ? "bg-teal-800 text-white shadow-sm" : "text-slate-600 hover:bg-teal-50 hover:text-teal-900"}`}><Icon className="h-3.5 w-3.5" />{label}</Link>;
            })}
          </nav>
          <div className="hidden items-center gap-2 sm:flex">
            <Link href="/timeline" className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"><History className="h-4 w-4" />السجل الكامل</Link>
            <button onClick={handleLogout} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50" title="تسجيل الخروج"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
        <nav className="container flex gap-2 overflow-x-auto pb-3 lg:hidden" aria-label="بوابات السجل على الهاتف">
          {navigation.map(({ href, label, Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return <Link key={href} href={href} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold ${active ? "bg-teal-800 text-white" : "border border-slate-200 bg-white text-slate-600"}`}><Icon className="h-3.5 w-3.5" />{label}</Link>;
          })}
        </nav>
      </header>
      <main>{children}</main>
      <footer className="mt-16 border-t border-slate-200 bg-white"><div className="container flex flex-col gap-2 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between"><p>رفيق الصحة — سجل متابعة منظم للمعلومات الطبية.</p><p className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> ليس بديلاً عن الرعاية أو التشخيص الطبي.</p></div></footer>
    </div>
  );
}

export function MedicalNotice() {
  return <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 sm:flex sm:items-center sm:gap-4 sm:p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-sky-700 shadow-sm"><ShieldCheck className="h-5 w-5" /></span><p className="mt-3 text-sm leading-6 text-slate-700 sm:mt-0"><strong className="text-slate-900">تنبيه مهم:</strong> هذه المساحة لتنظيم المعلومات وفهم تسلسلها، وليست للتشخيص أو اتخاذ قرار علاجي. تُراجع التقارير الأصلية والطبيب قبل أي قرار صحي.</p></div>;
}
