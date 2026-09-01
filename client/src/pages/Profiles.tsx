import { PortalShell } from "@/components/PortalShell";
import { useProfile } from "@/contexts/ProfileContext";
import { trpc } from "@/lib/trpc";
import { Check, Loader2, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { useState } from "react";

const RELATIONS = ["نفسي", "الوالد", "الوالدة", "الزوج/الزوجة", "ابن", "ابنة", "أخ", "أخت", "أخرى"];

export default function Profiles() {
  const utils = trpc.useUtils();
  const { profiles, setProfileId, activeProfile } = useProfile();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState(RELATIONS[0]);
  const [year, setYear] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const reset = async () => {
    setAdding(false);
    setEditingId(null);
    setConfirmId(null);
    setName("");
    setRelation(RELATIONS[0]);
    setYear("");
    setErr(null);
    await utils.profiles.invalidate();
    await utils.medical.invalidate();
  };
  const fail = (e: { message: string }) => setErr(e.message);

  const create = trpc.profiles.create.useMutation({ onSuccess: reset, onError: fail });
  const update = trpc.profiles.update.useMutation({ onSuccess: reset, onError: fail });
  const remove = trpc.profiles.remove.useMutation({ onSuccess: reset, onError: fail });

  const busy = create.isPending || update.isPending || remove.isPending;
  const field = "rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-700";

  const startEdit = (p: typeof profiles[number]) => {
    setEditingId(p.id);
    setAdding(false);
    setName(p.name);
    setRelation(p.relation ?? RELATIONS[0]);
    setYear(p.birthYear ? String(p.birthYear) : "");
    setErr(null);
  };

  const submit = () => {
    const payload = {
      name: name.trim(),
      relation: relation || null,
      birthYear: year.trim() ? Number(year) : null,
    };
    if (editingId) update.mutate({ profileId: editingId, ...payload });
    else create.mutate(payload);
  };

  return (
    <PortalShell>
      <div className="container max-w-3xl py-8">
        <h1 className="mb-1 text-2xl font-extrabold text-teal-950">الملفات الصحية</h1>
        <p className="mb-6 text-sm text-slate-500">
          أضف أفراد عائلتك ليكون لكل واحد سجله الطبي المستقل، وتنقّل بينهم من أعلى الصفحة.
        </p>

        {err && (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{err}</p>
        )}

        <div className="space-y-3">
          {profiles.map(p => (
            <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              {editingId === p.id ? (
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-slate-600">الاسم</span>
                    <input value={name} onChange={e => setName(e.target.value)} className={`${field} w-44`} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-slate-600">صلة القرابة</span>
                    <select value={relation} onChange={e => setRelation(e.target.value)} className={`${field} w-36`}>
                      {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-slate-600">سنة الميلاد</span>
                    <input value={year} dir="ltr" onChange={e => setYear(e.target.value)} className={`${field} w-28`} />
                  </label>
                  <button onClick={submit} disabled={busy}
                    className="flex items-center gap-1.5 rounded-lg bg-teal-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}حفظ
                  </button>
                  <button onClick={() => reset()} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">إلغاء</button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-800">
                      <Users className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-extrabold text-slate-900">
                        {p.name}
                        {p.isPrimary && (
                          <span className="mr-2 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800">رئيسي</span>
                        )}
                        {activeProfile?.id === p.id && (
                          <span className="mr-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">محدد الآن</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {p.relation ?? "—"}{p.birthYear ? ` · مواليد ${p.birthYear}` : ""} · {p.visitCount} تقرير
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {activeProfile?.id !== p.id && (
                      <button onClick={() => setProfileId(p.id)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-teal-300 hover:text-teal-800">
                        تحديد
                      </button>
                    )}
                    <button onClick={() => startEdit(p)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-teal-300 hover:text-teal-800">
                      <Pencil className="h-3.5 w-3.5" />تعديل
                    </button>
                    {!p.isPrimary && (
                      <button onClick={() => { setConfirmId(p.id); setErr(null); }}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 hover:border-red-300 hover:bg-red-50 hover:text-red-700">
                        <Trash2 className="h-3.5 w-3.5" />حذف
                      </button>
                    )}
                  </div>
                </div>
              )}

              {confirmId === p.id && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-extrabold text-red-800">حذف الملف نهائياً</p>
                  <p className="mt-1 text-xs leading-5 text-red-700">
                    سيتم حذف <span className="font-bold">{p.name}</span> و{p.visitCount} تقرير مع جميع نتائجها. لا يمكن التراجع.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => remove.mutate({ profileId: p.id })} disabled={busy}
                      className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">نعم، احذف</button>
                    <button onClick={() => setConfirmId(null)}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600">إلغاء</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {adding ? (
          <div className="mt-4 rounded-2xl border-2 border-dashed border-teal-300 bg-white p-4">
            <p className="mb-3 text-sm font-extrabold text-slate-900">ملف جديد</p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-slate-600">الاسم</span>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="الاسم الكامل" className={`${field} w-44`} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-slate-600">صلة القرابة</span>
                <select value={relation} onChange={e => setRelation(e.target.value)} className={`${field} w-36`}>
                  {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-slate-600">سنة الميلاد</span>
                <input value={year} dir="ltr" onChange={e => setYear(e.target.value)} placeholder="1965" className={`${field} w-28`} />
              </label>
              <button onClick={submit} disabled={busy || name.trim().length < 2}
                className="flex items-center gap-1.5 rounded-lg bg-teal-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}إضافة
              </button>
              <button onClick={() => reset()} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">
                <X className="h-3.5 w-3.5" />إلغاء
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => { setAdding(true); setEditingId(null); setName(""); setErr(null); }}
            className="mt-4 flex items-center gap-2 rounded-xl bg-teal-800 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-teal-900">
            <Plus className="h-4 w-4" />إضافة ملف جديد
          </button>
        )}
      </div>
    </PortalShell>
  );
}
