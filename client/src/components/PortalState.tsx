import { CircleAlert, LoaderCircle } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";

export function PortalLoading() {
  const { t, dir } = useLocale();
  return <div className="flex min-h-[55vh] items-center justify-center px-5" dir={dir}><div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-5 text-slate-700 shadow-sm"><LoaderCircle className="h-5 w-5 animate-spin text-teal-700" />{t.state.preparingRecord}</div></div>;
}

export function PortalError() {
  const { t, dir } = useLocale();
  return <div className="flex min-h-[55vh] items-center justify-center px-5" dir={dir}><section className="max-w-md rounded-3xl border border-amber-200 bg-white p-7 text-center shadow-sm"><CircleAlert className="mx-auto h-8 w-8 text-amber-700" /><h1 className="mt-4 text-xl font-extrabold text-slate-900">{t.state.loadErrorTitle}</h1><p className="mt-2 text-sm leading-6 text-slate-600">{t.state.loadErrorBody}</p></section></div>;
}
