import { FilePlus2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";

/** Shown when a portal has no records yet, so the page never looks broken. */
export function EmptyPortal({
  Icon,
  title,
  hint,
}: {
  Icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="col-span-full rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <Icon className="mx-auto h-9 w-9 text-slate-300" />
      <p className="mt-4 text-base font-extrabold text-slate-700">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {hint ?? "ارفع تقريراً لتظهر نتائجه هنا تلقائياً."}
      </p>
      <Link
        href="/upload"
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-900"
      >
        <FilePlus2 className="h-4 w-4" />
        رفع تقرير
      </Link>
    </div>
  );
}
