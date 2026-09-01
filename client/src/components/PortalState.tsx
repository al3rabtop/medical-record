import { CircleAlert, LoaderCircle } from "lucide-react";

export function PortalLoading() {
  return <div className="flex min-h-[55vh] items-center justify-center px-5" dir="rtl"><div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-5 text-slate-700 shadow-sm"><LoaderCircle className="h-5 w-5 animate-spin text-teal-700" />يجري إعداد السجل…</div></div>;
}

export function PortalError() {
  return <div className="flex min-h-[55vh] items-center justify-center px-5" dir="rtl"><section className="max-w-md rounded-3xl border border-amber-200 bg-white p-7 text-center shadow-sm"><CircleAlert className="mx-auto h-8 w-8 text-amber-700" /><h1 className="mt-4 text-xl font-extrabold text-slate-900">تعذر تحميل السجل حالياً</h1><p className="mt-2 text-sm leading-6 text-slate-600">يمكن إعادة المحاولة بعد قليل. لم يُجرَ أي تعديل على البيانات.</p></section></div>;
}
