import { trpc } from "@/lib/trpc";
import {
  Ban,
  Check,
  KeyRound,
  Loader2,
  Pencil,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useState } from "react";

export type AdminUser = {
  id: number;
  email: string;
  patientName: string | null;
  birthYear: number | null;
  role: "user" | "admin";
  status: "active" | "suspended";
  canUpload: boolean;
  createdAt: string | Date;
  lastSignedIn: string | Date;
  visitCount: number;
  resultCount: number;
};

function fmt(d: string | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar", { year: "numeric", month: "short", day: "numeric" });
}

export function AdminUserRow({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"view" | "edit" | "password" | "confirmDelete">("view");
  const [email, setEmail] = useState(user.email);
  const [name, setName] = useState(user.patientName ?? "");
  const [year, setYear] = useState(user.birthYear ? String(user.birthYear) : "");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const done = async () => {
    setErr(null);
    setMode("view");
    setPassword("");
    await utils.admin.invalidate();
  };
  const fail = (e: { message: string }) => setErr(e.message);

  const update = trpc.admin.updateUser.useMutation({ onSuccess: done, onError: fail });
  const setPw = trpc.admin.setPassword.useMutation({ onSuccess: done, onError: fail });
  const setStatus = trpc.admin.setStatus.useMutation({ onSuccess: done, onError: fail });
  const setUpload = trpc.admin.setCanUpload.useMutation({ onSuccess: done, onError: fail });
  const setRole = trpc.admin.setRole.useMutation({ onSuccess: done, onError: fail });
  const del = trpc.admin.deleteUser.useMutation({ onSuccess: done, onError: fail });

  const busy =
    update.isPending || setPw.isPending || setStatus.isPending ||
    setUpload.isPending || setRole.isPending || del.isPending;

  const btn = "flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold transition disabled:opacity-50";

  return (
    <>
      <tr className={`border-b border-slate-100 ${user.status === "suspended" ? "bg-red-50/40" : ""}`}>
        <td className="p-3 font-bold text-slate-800">
          {user.patientName ?? "—"}
          {user.role === "admin" && (
            <span className="mr-2 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800">مدير</span>
          )}
          {isSelf && (
            <span className="mr-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">أنت</span>
          )}
        </td>
        <td className="p-3 text-slate-600" dir="ltr">{user.email}</td>
        <td className="p-3 text-slate-500" dir="ltr">{user.birthYear ?? "—"}</td>
        <td className="p-3 font-bold text-slate-700">{user.visitCount}</td>
        <td className="p-3 text-slate-500">{fmt(user.lastSignedIn)}</td>
        <td className="p-3">
          <div className="flex flex-wrap gap-1">
            {user.status === "suspended" && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">موقوف</span>
            )}
            {!user.canUpload && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">الرفع معطّل</span>
            )}
            {user.status === "active" && user.canUpload && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">نشط</span>
            )}
          </div>
        </td>
        <td className="p-3">
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => { setMode(mode === "edit" ? "view" : "edit"); setErr(null); }}
              disabled={busy} className={`${btn} text-slate-600 hover:border-teal-300 hover:text-teal-800`}>
              <Pencil className="h-3.5 w-3.5" />تعديل
            </button>
            <button onClick={() => { setMode(mode === "password" ? "view" : "password"); setErr(null); }}
              disabled={busy} className={`${btn} text-slate-600 hover:border-teal-300 hover:text-teal-800`}>
              <KeyRound className="h-3.5 w-3.5" />كلمة المرور
            </button>
            <button onClick={() => setUpload.mutate({ userId: user.id, canUpload: !user.canUpload })}
              disabled={busy} className={`${btn} ${user.canUpload ? "text-slate-600 hover:border-amber-300 hover:text-amber-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
              <Upload className="h-3.5 w-3.5" />{user.canUpload ? "إيقاف الرفع" : "تفعيل الرفع"}
            </button>
            {!isSelf && (
              <>
                <button onClick={() => setStatus.mutate({ userId: user.id, status: user.status === "active" ? "suspended" : "active" })}
                  disabled={busy} className={`${btn} ${user.status === "active" ? "text-slate-600 hover:border-red-300 hover:text-red-700" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
                  <Ban className="h-3.5 w-3.5" />{user.status === "active" ? "حظر" : "إلغاء الحظر"}
                </button>
                <button onClick={() => setRole.mutate({ userId: user.id, role: user.role === "admin" ? "user" : "admin" })}
                  disabled={busy} className={`${btn} text-slate-600 hover:border-teal-300 hover:text-teal-800`}>
                  <ShieldCheck className="h-3.5 w-3.5" />{user.role === "admin" ? "إزالة الإدارة" : "ترقية لمدير"}
                </button>
                <button onClick={() => { setMode("confirmDelete"); setErr(null); }}
                  disabled={busy} className={`${btn} text-slate-500 hover:border-red-300 hover:bg-red-50 hover:text-red-700`}>
                  <Trash2 className="h-3.5 w-3.5" />حذف
                </button>
              </>
            )}
            {busy && <Loader2 className="h-4 w-4 animate-spin self-center text-teal-700" />}
          </div>
        </td>
      </tr>

      {(mode !== "view" || err) && (
        <tr className="border-b border-slate-100 bg-slate-50/70">
          <td colSpan={7} className="p-4">
            {err && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{err}</p>
            )}

            {mode === "edit" && (
              <div className="flex flex-wrap items-end gap-3">
                <Field label="البريد الإلكتروني" value={email} onChange={setEmail} dir="ltr" w="w-56" />
                <Field label="اسم المريض" value={name} onChange={setName} w="w-44" />
                <Field label="سنة الميلاد" value={year} onChange={setYear} dir="ltr" w="w-28" />
                <button onClick={() => update.mutate({
                  userId: user.id,
                  email,
                  patientName: name.trim() || null,
                  birthYear: year.trim() ? Number(year) : null,
                })} disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg bg-teal-800 px-4 py-2 text-xs font-bold text-white hover:bg-teal-900 disabled:opacity-50">
                  <Check className="h-3.5 w-3.5" />حفظ
                </button>
                <button onClick={() => { setMode("view"); setErr(null); }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">
                  <X className="h-3.5 w-3.5" />إلغاء
                </button>
              </div>
            )}

            {mode === "password" && (
              <div className="flex flex-wrap items-end gap-3">
                <Field label="كلمة مرور جديدة (8 أحرف فأكثر)" value={password} onChange={setPassword} dir="ltr" w="w-64" type="text" />
                <button onClick={() => setPw.mutate({ userId: user.id, password })}
                  disabled={busy || password.length < 8}
                  className="flex items-center gap-1.5 rounded-lg bg-teal-800 px-4 py-2 text-xs font-bold text-white hover:bg-teal-900 disabled:opacity-50">
                  <Check className="h-3.5 w-3.5" />تعيين
                </button>
                <button onClick={() => { setMode("view"); setPassword(""); setErr(null); }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">
                  <X className="h-3.5 w-3.5" />إلغاء
                </button>
                <p className="w-full text-[11px] text-slate-500">
                  بعد التعيين، أبلغ صاحب الحساب بكلمة المرور الجديدة وانصحه بتغييرها.
                </p>
              </div>
            )}

            {mode === "confirmDelete" && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-extrabold text-red-800">حذف نهائي للحساب</p>
                <p className="mt-1 text-xs leading-5 text-red-700">
                  سيتم حذف حساب <span className="font-bold" dir="ltr">{user.email}</span> مع
                  جميع تقاريره ({user.visitCount} تقرير، {user.resultCount} نتيجة) نهائياً. لا يمكن التراجع.
                </p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => del.mutate({ userId: user.id })} disabled={busy}
                    className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50">
                    نعم، احذف نهائياً
                  </button>
                  <button onClick={() => { setMode("view"); setErr(null); }}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600">
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function Field({ label, value, onChange, dir, w, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void;
  dir?: string; w?: string; type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold text-slate-600">{label}</span>
      <input type={type} value={value} dir={dir} onChange={e => onChange(e.target.value)}
        className={`${w ?? "w-48"} rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-700`} />
    </label>
  );
}
