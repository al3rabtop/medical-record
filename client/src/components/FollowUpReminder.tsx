import { trpc } from "@/lib/trpc";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { useState } from "react";

/**
 * Lets the user record a follow-up date their doctor gave them for this
 * test — deliberately not a system-generated interval, since recommending
 * a specific re-check timeline is a clinical judgment, not ours to make.
 */
export function FollowUpReminder({
  resultId,
  followUpDate,
}: {
  resultId: number;
  followUpDate: string | null;
}) {
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(followUpDate ?? "");

  const setReminder = trpc.medical.setFollowUpDate.useMutation({
    onSuccess: async () => {
      setEditing(false);
      await utils.medical.invalidate();
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const overdue = followUpDate !== null && followUpDate < today;

  if (!editing && followUpDate) {
    return (
      <div
        className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm ${
          overdue ? "bg-amber-50 text-amber-900" : "bg-teal-50 text-teal-900"
        }`}
      >
        <span className="flex items-center gap-2 font-bold">
          <Bell className="h-4 w-4" />
          {overdue ? "موعد إعادة الفحص فات" : "موعد إعادة الفحص"}: <span dir="ltr">{followUpDate}</span>
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg px-2 py-1 text-xs font-bold underline decoration-dotted"
          >
            تعديل
          </button>
          <button
            onClick={() => setReminder.mutate({ resultId, followUpDate: null })}
            disabled={setReminder.isPending}
            className="rounded-lg px-2 py-1 text-xs font-bold underline decoration-dotted"
          >
            إلغاء
          </button>
        </div>
      </div>
    );
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-500 transition hover:border-teal-300 hover:text-teal-800"
      >
        <BellOff className="h-4 w-4" />
        إضافة تذكير بإعادة الفحص
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <input
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-teal-700"
      />
      <button
        onClick={() => date && setReminder.mutate({ resultId, followUpDate: date })}
        disabled={!date || setReminder.isPending}
        className="flex items-center gap-1.5 rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
      >
        {setReminder.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        حفظ
      </button>
      <button
        onClick={() => setEditing(false)}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
      >
        إلغاء
      </button>
      <p className="w-full text-[11px] text-slate-500">
        سجّل التاريخ اللي حدّده طبيبك لإعادة هذا الفحص — التطبيق ما يقترح موعداً بنفسه.
      </p>
    </div>
  );
}
