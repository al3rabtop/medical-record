import { trpc } from "@/lib/trpc";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";

type Draft = {
  id: number;
  label: string;
  value: string;
  unit: string;
  referenceRange: string;
};

/** Inline editor for the results inside one visit. */
export function VisitResultsEditor({ visitId }: { visitId: number }) {
  const { t } = useLocale();
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [err, setErr] = useState<string | null>(null);

  const results = trpc.medical.visitResults.useQuery({ visitId }, { enabled: editing });

  const update = trpc.medical.updateResult.useMutation({
    onError: e => setErr(e.message),
  });

  const start = () => {
    setErr(null);
    setEditing(true);
  };

  const stop = () => {
    setEditing(false);
    setDrafts({});
    setErr(null);
  };

  const draftFor = (r: NonNullable<typeof results.data>[number]): Draft =>
    drafts[r.id] ?? {
      id: r.id,
      label: r.label,
      value: r.valueText,
      unit: r.unit ?? "",
      referenceRange: r.referenceRange ?? "",
    };

  const set = (id: number, patch: Partial<Draft>, base: Draft) =>
    setDrafts(p => ({ ...p, [id]: { ...base, ...patch } }));

  async function saveAll() {
    setErr(null);
    const changed = Object.values(drafts);
    for (const d of changed) {
      const n = Number(d.value.replace(",", "."));
      await update.mutateAsync({
        resultId: d.id,
        label: d.label,
        value: d.value,
        numericValue: d.value.trim() && !Number.isNaN(n) ? n : null,
        unit: d.unit.trim() || null,
        referenceRange: d.referenceRange.trim() || null,
      });
    }
    await utils.medical.invalidate();
    stop();
  }

  if (!editing) {
    return (
      <button
        onClick={start}
        className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-teal-300 hover:text-teal-800"
      >
        <Pencil className="h-4 w-4" />
        {t.visitEditor.editResults}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-sm font-extrabold text-slate-900">{t.visitEditor.editResults}</p>

      {err && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{err}</p>
      )}

      {results.isLoading && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-teal-800" />
        </div>
      )}

      {results.data && (
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 font-bold">{t.table.test}</th>
                <th className="px-3 py-2 font-bold">{t.table.result}</th>
                <th className="px-3 py-2 font-bold">{t.visitEditor.unit}</th>
                <th className="px-3 py-2 font-bold">{t.table.referenceRange}</th>
              </tr>
            </thead>
            <tbody>
              {results.data.map(r => {
                const d = draftFor(r);
                return (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">
                      <input value={d.label} onChange={e => set(r.id, { label: e.target.value }, d)}
                        className="w-full min-w-32 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-teal-700" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={d.value} dir="ltr" onChange={e => set(r.id, { value: e.target.value }, d)}
                        className="w-full min-w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-teal-700" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={d.unit} dir="ltr" onChange={e => set(r.id, { unit: e.target.value }, d)}
                        className="w-full min-w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-teal-700" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={d.referenceRange} dir="ltr" onChange={e => set(r.id, { referenceRange: e.target.value }, d)}
                        className="w-full min-w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-teal-700" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={saveAll} disabled={update.isPending || Object.keys(drafts).length === 0}
          className="flex items-center gap-2 rounded-lg bg-teal-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-900 disabled:opacity-50">
          {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {t.visitEditor.saveChanges}
        </button>
        <button onClick={stop}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">
          <X className="h-4 w-4" />
          {t.common.cancel}
        </button>
        <p className="text-[11px] text-slate-500">
          {t.visitEditor.autoStatusNote}
        </p>
      </div>
    </div>
  );
}
