import { PortalShell } from "@/components/PortalShell";
import { trpc } from "@/lib/trpc";
import { Check, KeyRound, Loader2, UserCircle2 } from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";

export default function Settings() {
  const { t } = useLocale();
  const me = trpc.auth.me.useQuery();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);

    if (next !== confirm) {
      setError(t.settings.passwordsDontMatch);
      return;
    }
    if (next.length < 8) {
      setError(t.settings.passwordTooShort);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t.settings.changePasswordGenericError);
        return;
      }
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch {
      setError(t.settings.connectionError);
    } finally {
      setSaving(false);
    }
  }

  const field =
    "rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20";

  return (
    <PortalShell>
      <div className="container max-w-2xl py-8">
        <h1 className="mb-1 text-2xl font-extrabold text-teal-950">{t.settings.pageTitle}</h1>
        <p className="mb-6 text-sm text-slate-500">{t.settings.pageDescription}</p>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
            <UserCircle2 className="h-4 w-4 text-teal-700" />
            {t.settings.accountInfoTitle}
          </h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold text-slate-500">{t.settings.email}</dt>
              <dd className="mt-1 text-sm font-bold text-slate-800" dir="ltr">
                {me.data?.email ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-slate-500">{t.settings.patientName}</dt>
              <dd className="mt-1 text-sm font-bold text-slate-800">
                {me.data?.patientName ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-slate-500">{t.settings.birthYear}</dt>
              <dd className="mt-1 text-sm font-bold text-slate-800" dir="ltr">
                {me.data?.birthYear ?? "—"}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            {t.settings.editContactAdmin}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
            <KeyRound className="h-4 w-4 text-teal-700" />
            {t.settings.changePasswordTitle}
          </h2>

          <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-slate-700">{t.settings.currentPassword}</span>
              <input type="password" required value={current} dir="ltr"
                onChange={e => setCurrent(e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-slate-700">{t.settings.newPassword}</span>
              <input type="password" required minLength={8} value={next} dir="ltr"
                onChange={e => setNext(e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-slate-700">{t.settings.confirmNewPassword}</span>
              <input type="password" required minLength={8} value={confirm} dir="ltr"
                onChange={e => setConfirm(e.target.value)} className={field} />
            </label>

            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</p>
            )}
            {done && (
              <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                <Check className="h-4 w-4" />
                {t.settings.passwordChangedSuccess}
              </p>
            )}

            <button type="submit" disabled={saving}
              className="mt-1 flex w-fit items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-teal-900 disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.settings.savePassword}
            </button>
          </form>
        </div>
      </div>
    </PortalShell>
  );
}
